"use client";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

export default function AlunoGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const redirectedRef = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
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
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router, pathname]);

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
