"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

function getBreadcrumb(pathname: string | null) {
  if (!pathname) return "Início";

  if (pathname.startsWith("/aluno/resolver")) return "Simulado";
  if (pathname.startsWith("/aluno/simulados")) return "Simulados";
  if (pathname.startsWith("/aluno/provas")) return "Provas";
  if (pathname.startsWith("/aluno/ranking")) return "Ranking";
  if (pathname.startsWith("/aluno/assinatura")) return "Assinatura";
  if (pathname.startsWith("/aluno/perfil")) return "Perfil";

  return "Início";
}

export default function AlunoTopHeader({
  onMenuClick,
}: {
  onMenuClick?: () => void;
}) {
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  const breadcrumb = useMemo(() => getBreadcrumb(pathname), [pathname]);

  const initials = useMemo(() => {
    const email = user?.email ?? "";
    const base = email.trim().slice(0, 2).toUpperCase();
    return base || "AQ";
  }, [user]);

  return (
    <header className="sticky top-0 z-30 overflow-hidden border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Botão menu (mobile/tablet) */}
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-700 shadow-sm lg:hidden"
            aria-label="Abrir menu"
          >
            ☰
          </button>

          <div className="min-w-0">
            <div className="text-xs text-slate-500 font-semibold">
              Área do Aluno
            </div>
            <div className="text-lg font-black text-slate-900 truncate">
              {breadcrumb}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex min-w-0 shrink-0 items-center gap-3">
          <div className="hidden sm:block text-sm text-slate-600 truncate max-w-[220px]">
            {user?.email ?? ""}
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white shadow-lg sm:h-10 sm:w-10">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
