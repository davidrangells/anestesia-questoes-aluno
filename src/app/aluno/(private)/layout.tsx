"use client";

import { useState } from "react";
import AlunoGuard from "@/components/AlunoGuard";
import AlunoSidebar from "@/components/aluno/AlunoSidebar";
import AlunoTopHeader from "@/components/aluno/AlunoTopHeader";

export default function AlunoPrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AlunoGuard>
      <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(1200px_circle_at_20%_0%,rgba(15,23,42,0.06),transparent_55%),radial-gradient(900px_circle_at_100%_20%,rgba(2,132,199,0.08),transparent_45%)]">
        <div className="flex min-h-screen">
          
          {/* Sidebar desktop */}
          <AlunoSidebar variant="desktop" />

          {/* Conteúdo */}
          <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
            <AlunoTopHeader onMenuClick={() => setMobileOpen(true)} />

            <main className="min-w-0 flex-1 overflow-x-hidden">
              <div className="px-4 sm:px-6 lg:px-10 py-8">
                <div className="mx-auto w-full max-w-[1200px]">
                  {children}
                </div>
              </div>
            </main>
          </div>
        </div>

        {/* Drawer mobile */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* overlay */}
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />

            {/* painel lateral */}
            <div className="absolute left-0 top-0 flex h-full w-[85vw] max-w-[320px] flex-col bg-white shadow-2xl">
              <div className="flex items-center justify-between px-4 py-4 border-b">
                <div className="text-sm font-black text-slate-900">
                  Menu
                </div>
                <button
                  className="h-10 w-10 rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
                  onClick={() => setMobileOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <AlunoSidebar
                  variant="drawer"
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AlunoGuard>
  );
}
