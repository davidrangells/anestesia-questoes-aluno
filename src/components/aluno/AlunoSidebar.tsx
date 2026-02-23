"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function Item({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  const pathname = usePathname();

  // ✅ Dashboard só fica ativo quando estiver exatamente em /aluno
  const isDashboard = href === "/aluno";
  const active = isDashboard
    ? pathname === "/aluno"
    : pathname === href || pathname?.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
        active
          ? "bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)]"
          : "text-slate-700 hover:bg-slate-100"
      )}
    >
      <span
        className={cn(
          "text-base",
          active ? "opacity-100" : "opacity-80 group-hover:opacity-100"
        )}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function AlunoSidebar() {
  const router = useRouter();

  const logout = async () => {
    await signOut(auth);
    router.replace("/aluno/entrar");
  };

  return (
    <aside className="hidden lg:flex w-[320px] shrink-0 border-r bg-white min-h-screen sticky top-0 flex-col">
      {/* Brand */}
      <div className="px-5 py-5 border-b">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black">
            AQ
          </div>
          <div className="min-w-0">
            <div className="text-lg font-black text-slate-900 truncate">
              Anestesia Questões
            </div>
            <div className="text-xs text-slate-500">Área do Aluno</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-4 py-4 flex flex-col gap-2">
        <Item href="/aluno" label="Dashboard" icon="🏠" />
        <Item href="/aluno/provas" label="Provas" icon="📝" />
        <Item href="/aluno/ranking" label="Ranking" icon="🏆" />
        <Item href="/aluno/perfil" label="Perfil" icon="👤" />
      </nav>

      {/* Footer actions */}
      <div className="mt-auto px-4 py-4 border-t">
        <button
          onClick={logout}
          className="w-full rounded-2xl px-4 py-3 text-sm bg-slate-900 text-white hover:bg-slate-800 transition font-semibold"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}