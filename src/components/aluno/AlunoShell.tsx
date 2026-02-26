"use client";

import { useState } from "react";
import Link from "next/link";

export default function AlunoShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Botão menu mobile */}
            <button
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              ☰
            </button>

            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-500">
                Área do Aluno
              </div>
              <div className="text-lg font-black text-slate-900 truncate">
                {title ?? "Dashboard"}
              </div>
              {subtitle ? (
                <div className="text-sm text-slate-600 truncate">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {actions}

            {/* Avatar */}
            <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow">
              TE
            </div>
          </div>
        </div>
      </header>

      {/* LAYOUT */}
      <div className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
        {/* SIDEBAR desktop */}
        <aside className="hidden md:block">
          <Sidebar />
        </aside>

        {/* Conteúdo */}
        <main className="min-w-0">{children}</main>
      </div>

      {/* DRAWER mobile */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* overlay */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* painel lateral */}
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-[320px] bg-white shadow-2xl p-6 transition">
            <div className="flex items-center justify-between">
              <div className="text-lg font-black text-slate-900">
                Menu
              </div>
              <button
                className="h-10 w-10 rounded-xl border border-slate-200"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="mt-6">
              <Sidebar onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const item =
    "block rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition";

  return (
    <nav className="space-y-2">
      <Link className={item} href="/aluno/dashboard" onClick={onNavigate}>
        🏠 Dashboard
      </Link>
      <Link className={item} href="/aluno/provas" onClick={onNavigate}>
        📄 Provas
      </Link>
      <Link className={item} href="/aluno/simulados" onClick={onNavigate}>
        🧠 Simulados
      </Link>
      <Link className={item} href="/aluno/ranking" onClick={onNavigate}>
        🏆 Ranking
      </Link>
      <Link className={item} href="/aluno/perfil" onClick={onNavigate}>
        👤 Perfil
      </Link>
      <Link className={item} href="/aluno/assinatura" onClick={onNavigate}>
        💳 Assinatura
      </Link>
    </nav>
  );
}