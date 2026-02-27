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
  const [open, setOpen] = useState(false);

  return (
    <AlunoGuard>
      <div className="min-h-screen bg-slate-50">

        <div className="flex min-h-screen">

          {/* SIDEBAR DESKTOP */}
          <AlunoSidebar />

          <div className="flex-1 flex flex-col min-w-0">

            <AlunoTopHeader onOpenMenu={() => setOpen(true)} />

            <main className="flex-1 min-w-0">
              <div className="px-6 sm:px-8 lg:px-10 py-8">
                <div className="mx-auto w-full max-w-[1200px]">
                  {children}
                </div>
              </div>
            </main>
          </div>
        </div>

        {/* DRAWER MOBILE */}
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
            />

            <div className="absolute left-0 top-0 h-full w-[85%] max-w-[320px] bg-white shadow-2xl p-6">
              <nav className="space-y-2">
                <AlunoSidebar />
              </nav>
            </div>
          </div>
        )}
      </div>
    </AlunoGuard>
  );
}