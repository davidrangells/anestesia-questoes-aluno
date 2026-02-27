"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

type Props = {
  onNavigate?: () => void;
};

export default function AlunoSidebar({ onNavigate }: Props) {
  const pathname = usePathname();

  const base =
    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition";
  const active = "bg-slate-900 text-white shadow";
  const idle = "text-slate-700 hover:bg-slate-100";

  const Item = ({
    href,
    icon,
    label,
  }: {
    href: string;
    icon: string;
    label: string;
  }) => {
    const isActive =
      pathname === href || (href !== "/aluno" && pathname.startsWith(href));

    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(base, isActive ? active : idle)}
      >
        <span className="text-base">{icon}</span>
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <aside className="w-full">
      <div className="rounded-3xl border border-slate-200/70 bg-white/80 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur p-4">
        <div className="flex items-center gap-3 px-2 pb-4 border-b border-slate-200/60">
          <div className="h-11 w-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-extrabold">
            AQ
          </div>
          <div className="min-w-0">
            <div className="text-base font-black text-slate-900 truncate">
              Anestesia Questões
            </div>
            <div className="text-xs font-semibold text-slate-500">
              Área do Aluno
            </div>
          </div>
        </div>

        <nav className="mt-4 space-y-2">
          <Item href="/aluno" icon="🏠" label="Dashboard" />
          <Item href="/aluno/provas" icon="📄" label="Provas" />
          <Item href="/aluno/simulados" icon="🧠" label="Simulados" />
          <Item href="/aluno/ranking" icon="🏆" label="Ranking" />
          <Item href="/aluno/assinatura" icon="💳" label="Assinatura" />
          <Item href="/aluno/perfil" icon="👤" label="Perfil" />
        </nav>
      </div>
    </aside>
  );
}