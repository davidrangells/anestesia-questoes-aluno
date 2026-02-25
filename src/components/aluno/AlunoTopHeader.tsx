"use client";

import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";

function getBreadcrumb(pathname: string | null) {
  if (!pathname) return "Dashboard";

  if (pathname.startsWith("/aluno/resolver")) return "Simulado";
  if (pathname.startsWith("/aluno/simulados")) return "Simulados";
  if (pathname.startsWith("/aluno/provas")) return "Provas";
  if (pathname.startsWith("/aluno/ranking")) return "Ranking";
  if (pathname.startsWith("/aluno/perfil")) return "Perfil";

  return "Dashboard";
}

export default function AlunoTopHeader() {
  const pathname = usePathname();
  const user = auth.currentUser;

  const breadcrumb = getBreadcrumb(pathname);

  const initials =
    user?.email?.slice(0, 2).toUpperCase() ?? "AQ";

  return (
    <div className="sticky top-0 z-30 backdrop-blur bg-white/70 border-b border-slate-200/70">
      <div className="flex items-center justify-between px-6 lg:px-10 py-4">
        {/* Left */}
        <div>
          <div className="text-xs text-slate-500 font-semibold">
            Área do Aluno
          </div>
          <div className="text-lg font-black text-slate-900">
            {breadcrumb}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-sm text-slate-600">
            {user?.email}
          </div>

          <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-lg">
            {initials}
          </div>
        </div>
      </div>
    </div>
  );
}