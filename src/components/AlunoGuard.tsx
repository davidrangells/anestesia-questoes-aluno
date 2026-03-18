"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";

type TimestampLike = {
  seconds?: number;
  toDate?: () => Date;
};

type EntitlementDoc = {
  active?: boolean;
  validUntil?: unknown;
  dueDate?: unknown;
  contractDueDate?: unknown;
};

function isTimestampLike(value: unknown): value is TimestampLike {
  return typeof value === "object" && value !== null;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (isTimestampLike(v) && typeof v.seconds === "number") return new Date(v.seconds * 1000);
  return null;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getClientSessionId(uid: string) {
  if (typeof window === "undefined") return `server-${uid}`;

  const key = `aq.aluno.active-session.${uid}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const generated =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  window.localStorage.setItem(key, generated);
  return generated;
}

const FALLBACK_LOCK_DOC_ID = "__active_session_lock__";

export default function AlunoGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const redirectedRef = useRef(false);
  const heartbeatRef = useRef<number | null>(null);
  const sessionCheckRef = useRef<number | null>(null);
  const activeSessionUnsubRef = useRef<(() => void) | null>(null);
  const signingOutBySessionRef = useRef(false);

  const clearSessionSync = useCallback(() => {
    if (heartbeatRef.current != null) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (activeSessionUnsubRef.current) {
      activeSessionUnsubRef.current();
      activeSessionUnsubRef.current = null;
    }
    if (sessionCheckRef.current != null) {
      window.clearInterval(sessionCheckRef.current);
      sessionCheckRef.current = null;
    }
  }, []);

  const forceSessionLogout = useCallback(() => {
    if (signingOutBySessionRef.current) return;
    signingOutBySessionRef.current = true;
    clearSessionSync();
    void auth.signOut().finally(() => {
      router.replace("/aluno/entrar?erro=sessao_ativa");
    });
  }, [clearSessionSync, router]);

  const attachSessionMonitor = useCallback((activeSessionRef: ReturnType<typeof doc>, clientSessionId: string) => {
    activeSessionUnsubRef.current = onSnapshot(
      activeSessionRef,
      (snap) => {
        const data = snap.data() as { sessionId?: unknown } | undefined;
        const remoteSessionId = String(data?.sessionId ?? "").trim();
        if (!remoteSessionId || remoteSessionId === clientSessionId) return;
        forceSessionLogout();
      },
      () => {
        // fallback para ambientes onde o listener real-time falhar
      }
    );

    // Fallback de segurança para garantir exclusão de sessão mesmo sem onSnapshot.
    sessionCheckRef.current = window.setInterval(() => {
      void getDocFromServer(activeSessionRef)
        .then((snap) => {
          const data = snap.data() as { sessionId?: unknown } | undefined;
          const remoteSessionId = String(data?.sessionId ?? "").trim();
          if (!remoteSessionId || remoteSessionId === clientSessionId) return;
          forceSessionLogout();
        })
        .catch(() => {
          // best-effort
        });
    }, 6_000);
  }, [forceSessionLogout]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      clearSessionSync();
      if (user) {
        signingOutBySessionRef.current = false;
      }

      try {
        if (!user) {
          if (signingOutBySessionRef.current) {
            if (!redirectedRef.current) {
              redirectedRef.current = true;
              router.replace("/aluno/entrar?erro=sessao_ativa");
            }
            return;
          }

          if (!redirectedRef.current) {
            redirectedRef.current = true;
            router.replace("/aluno/entrar");
          }
          return;
        }

        // ✅ Rotas liberadas mesmo sem assinatura
        const allowWithoutEntitlement = ["/aluno/assinatura", "/aluno/perfil"];
        const isAllowedRoute = allowWithoutEntitlement.some((p) => pathname?.startsWith(p));

        const entRef = doc(db, "entitlements", user.uid);
        const entSnap = await getDoc(entRef);

        const ent = entSnap.exists() ? (entSnap.data() as EntitlementDoc) : null;

        const active = Boolean(ent?.active);
        const validUntil = toDate(ent?.validUntil || ent?.dueDate || ent?.contractDueDate);
        const expired = validUntil ? validUntil < startOfToday() : false;

        // ✅ Se não tem entitlement / inativo / expirado, manda para assinatura
        if (!isAllowedRoute && (!ent || !active || expired)) {
          const reason = !ent ? "no_entitlement" : !active ? "inactive" : "expired";
          router.replace(`/aluno/assinatura?reason=${reason}`);
          return;
        }

        const fallbackSessionRef = doc(db, "users", user.uid, "sessions", FALLBACK_LOCK_DOC_ID);
        const clientSessionId = getClientSessionId(user.uid);

        try {
          await runTransaction(db, async (tx) => {
            const snap = await tx.get(fallbackSessionRef);
            const data = snap.data() as { sessionId?: unknown; lastSeenAt?: unknown } | undefined;
            const currentSessionId = String(data?.sessionId ?? "").trim();
            const currentLastSeenMs = toDate(data?.lastSeenAt)?.getTime() ?? 0;
            const isCurrentLockAlive = currentLastSeenMs > 0 && Date.now() - currentLastSeenMs < 20_000;

            if (
              currentSessionId &&
              currentSessionId !== clientSessionId &&
              isCurrentLockAlive
            ) {
              throw new Error("session_taken");
            }

            tx.set(
              fallbackSessionRef,
              {
                control: true,
                kind: "session_lock",
                uid: user.uid,
                sessionId: clientSessionId,
                device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 180) : "unknown",
                claimedAt: serverTimestamp(),
                lastSeenAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          });
        } catch (error) {
          if (error instanceof Error && error.message === "session_taken") {
            await auth.signOut();
            router.replace("/aluno/entrar?erro=sessao_ativa");
            return;
          }
          // Nao bloqueia acesso do aluno por falha de sincronizacao de sessao.
          // O controle de sessao simultanea fica em modo best-effort ate normalizar.
          console.error("Falha ao sincronizar lock de sessao:", error);
        }

        attachSessionMonitor(fallbackSessionRef, clientSessionId);

        heartbeatRef.current = window.setInterval(() => {
          void runTransaction(db, async (tx) => {
            const snap = await tx.get(fallbackSessionRef);
            const data = snap.data() as { sessionId?: unknown } | undefined;
            const currentSessionId = String(data?.sessionId ?? "").trim();

            // Se perdeu o lock para outro dispositivo, nao tenta sobrescrever.
            if (currentSessionId && currentSessionId !== clientSessionId) {
              throw new Error("lock_lost");
            }

            tx.set(
              fallbackSessionRef,
              {
                sessionId: clientSessionId,
                lastSeenAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }).catch((error) => {
            if (error instanceof Error && error.message === "lock_lost") {
              forceSessionLogout();
            }
            // heartbeat best-effort
          });
        }, 8_000);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      clearSessionSync();
      unsub();
    };
  }, [router, pathname, clearSessionSync, attachSessionMonitor, forceSessionLogout]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="rounded-3xl border bg-white shadow-sm px-6 py-5 text-slate-700">
          Carregando…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
