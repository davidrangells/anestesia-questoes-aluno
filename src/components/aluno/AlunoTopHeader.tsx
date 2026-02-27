"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";

function getBreadcrumb(pathname: string | null) {
  if (!pathname) return "Dashboard";

  if (pathname.startsWith("/aluno/resolver")) return "Simulado";
  if (pathname.startsWith("/aluno/simulados")) return "Simulados";
  if (pathname.startsWith("/aluno/provas")) return "Provas";
  if (pathname.startsWith("/aluno/ranking")) return "Ranking";
  if (pathname.startsWith("/aluno/assinatura")) return "Assinatura";
  if (pathname.startsWith("/aluno/perfil")) return "Perfil";

  return "Dashboard";
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
    <header className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b border-slate-200/70">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-10 py-4">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Botão menu (mobile/tablet) */}
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg"
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
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-sm text-slate-600 truncate max-w-[220px]">
            {user?.email ?? ""}
          </div>

          <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-lg">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}