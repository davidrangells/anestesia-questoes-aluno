"use client";

import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";

export default function AlunoGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        const isPublic =
          pathname?.startsWith("/aluno/entrar") ||
          pathname?.startsWith("/aluno/criar-senha");

        if (!user) {
          if (isPublic) {
            if (mountedRef.current) setLoading(false);
            return;
          }
          router.replace("/aluno/entrar");
          return;
        }

        // Checa entitlement por UID
        const entRef = doc(db, "entitlements", user.uid);
        const entSnap = await getDoc(entRef);

        const active = entSnap.exists() && entSnap.data()?.active === true;

        if (!active) {
          // logged, but no access
          router.replace("/aluno/entrar?erro=sem_acesso");
          return;
        }

        // se já tem acesso e está em páginas públicas -> manda pro painel
        if (isPublic) {
          router.replace("/aluno");
          return;
        }

        if (mountedRef.current) setLoading(false);
      } catch {
        router.replace("/aluno/entrar?erro=verificacao");
      }
    });

    return () => {
      mountedRef.current = false;
      unsub();
    };
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Carregando…
      </div>
    );
  }

  return <>{children}</>;
}