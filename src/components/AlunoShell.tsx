"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AlunoShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-black text-slate-900">Anestesia Questões</div>
            <div className="text-xs text-slate-500">{title}</div>
          </div>

          <button
            onClick={() => signOut(auth)}
            className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}