"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

function getInitials(email?: string | null) {
  if (!email) return "AQ";
  const name = email.split("@")[0] || "";
  const parts = name.split(/[.\-_]/g).filter(Boolean);
  const a = (parts[0]?.[0] || name[0] || "A").toUpperCase();
  const b = (parts[1]?.[0] || name[1] || "Q").toUpperCase();
  return `${a}${b}`;
}

function getTitleFromPath(pathname: string) {
  // ajuste conforme suas rotas reais
  if (pathname.startsWith("/aluno/provas")) return "Provas";
  if (pathname.startsWith("/aluno/simulados")) return "Simulados";
  if (pathname.startsWith("/aluno/ranking")) return "Ranking";
  if (pathname.startsWith("/aluno/assinatura")) return "Assinatura";
  if (pathname.startsWith("/aluno/perfil")) return "Perfil";
  return "Dashboard";
}

export default function AlunoTopHeader({
  onOpenMenu,
  userEmail,
}: {
  onOpenMenu?: () => void;
  userEmail?: string | null;
}) {
  const pathname = usePathname();

  const title = useMemo(() => getTitleFromPath(pathname || ""), [pathname]);
  const initials = useMemo(() => getInitials(userEmail), [userEmail]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Botão menu mobile */}
            <button
              type="button"
              onClick={onOpenMenu}
              className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900"
              aria-label="Abrir menu"
            >
              ☰
            </button>

            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500">
                Área do Aluno
              </div>
              <div className="text-lg sm:text-xl font-black text-slate-900 truncate">
                {title}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userEmail ? (
              <div className="hidden sm:block text-sm text-slate-600 truncate max-w-[260px]">
                {userEmail}
              </div>
            ) : null}

            <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-extrabold shadow">
              {initials}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}