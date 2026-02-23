"use client";

import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AlunoHome() {
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border bg-white p-6 flex items-center justify-between">
          <div>
            <div className="text-xl font-black text-slate-900">Bem-vindo 👋</div>
            <div className="text-sm text-slate-500">Acesso liberado — Anestesia Questões</div>
          </div>

          <button
            onClick={() => signOut(auth)}
            className="rounded-2xl border bg-white px-4 py-3 text-sm font-semibold hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}