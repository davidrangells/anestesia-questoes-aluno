"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import AlunoGuard from "@/components/AlunoGuard";
import AlunoSidebar from "@/components/aluno/AlunoSidebar";
import AlunoTopHeader from "@/components/aluno/AlunoTopHeader";

export default function AlunoPrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setEmail(u?.email ?? null));
    return () => unsub();
  }, []);

  return (
    <AlunoGuard>
      <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_0%,rgba(15,23,42,0.06),transparent_55%),radial-gradient(900px_circle_at_100%_20%,rgba(2,132,199,0.08),transparent_45%)]">
        <div className="flex min-h-screen">
          {/* Sidebar desktop */}
          <div className="hidden md:block w-[320px] p-6">
            <AlunoSidebar />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 flex flex-col min-w-0">
            <AlunoTopHeader onOpenMenu={() => setMobileOpen(true)} userEmail={email} />

            <main className="flex-1 min-w-0">
              <div className="px-4 sm:px-6 lg:px-8 py-8">
                <div className="mx-auto w-full max-w-[1200px]">{children}</div>
              </div>
            </main>
          </div>
        </div>

        {/* Drawer mobile */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-[88%] max-w-[340px] p-4">
              <div className="h-full">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-bold text-slate-900">Menu</div>
                  <button
                    className="h-10 w-10 rounded-2xl border border-slate-200 bg-white"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Fechar menu"
                  >
                    ✕
                  </button>
                </div>
                <AlunoSidebar onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AlunoGuard>
  );
}