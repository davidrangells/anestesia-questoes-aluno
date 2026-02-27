"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AlunoSidebar() {
  const pathname = usePathname();

  const itemBase =
    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition";

  const active =
    "bg-slate-900 text-white shadow";

  const inactive =
    "text-slate-700 hover:bg-slate-100";

  function itemClass(href: string) {
    return `${itemBase} ${
      pathname === href ? active : inactive
    }`;
  }

  return (
    <aside className="hidden lg:flex w-[260px] flex-col border-r bg-white p-6">
      <nav className="space-y-2">

        <Link href="/aluno" className={itemClass("/aluno")}>
          🏠 Dashboard
        </Link>

        <Link href="/aluno/provas" className={itemClass("/aluno/provas")}>
          📄 Provas
        </Link>

        <Link href="/aluno/simulados" className={itemClass("/aluno/simulados")}>
          🧠 Simulados
        </Link>

        <Link href="/aluno/ranking" className={itemClass("/aluno/ranking")}>
          🏆 Ranking
        </Link>

        <Link href="/aluno/perfil" className={itemClass("/aluno/perfil")}>
          👤 Perfil
        </Link>

        <Link href="/aluno/assinatura" className={itemClass("/aluno/assinatura")}>
          💳 Assinatura
        </Link>
      </nav>
    </aside>
  );
}