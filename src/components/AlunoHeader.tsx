"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

export default function AlunoHeader() {
  const [name, setName] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (user?.email) {
      const firstName = user.email.split("@")[0];
      setName(firstName);
    }
  }, []);

  return (
    <header className="bg-white border-b px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">
          Bem-vindo, {name} 👋
        </h1>
        <p className="text-sm text-slate-500">
          Acesso liberado — Área do Aluno
        </p>
      </div>
    </header>
  );
}