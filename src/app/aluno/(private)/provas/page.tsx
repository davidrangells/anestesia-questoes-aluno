"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import AlunoShell from "@/components/aluno/AlunoShell";

type Stats = {
  answeredCount: number;
  correctCount: number;
  streak: number;
};

export default function Page() {
  const [stats, setStats] = useState<Stats>({
    answeredCount: 0,
    correctCount: 0,
    streak: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();

        setStats({
          answeredCount: data?.answeredCount ?? 0,
          correctCount: data?.correctCount ?? 0,
          streak: data?.streak ?? 0,
        });
      }

      setLoading(false);
    };

    load();
  }, []);

  const accuracy =
    stats.answeredCount > 0
      ? Math.round((stats.correctCount / stats.answeredCount) * 100)
      : 0;

  return (
    <AlunoShell
      title="Dashboard"
      subtitle="Acompanhe seu desempenho e evolução"
    >
      {loading ? (
        <div className="rounded-2xl bg-white border p-6">
          <div className="text-sm text-slate-500">Carregando dados...</div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Questões Respondidas"
            value={stats.answeredCount}
            color="bg-blue-500"
          />

          <StatCard
            label="Acertos"
            value={stats.correctCount}
            color="bg-emerald-500"
          />

          <StatCard
            label="Taxa de Acerto"
            value={`${accuracy}%`}
            color="bg-violet-500"
          />

          <StatCard
            label="Streak Atual"
            value={stats.streak}
            color="bg-orange-500"
          />
        </div>
      )}

      {/* Área futura de gráficos */}
      <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-sm text-slate-500">Performance</div>
        <div className="mt-4 h-40 flex items-center justify-center text-slate-400 text-sm">
          Gráfico de evolução em breve 🚀
        </div>
      </div>
    </AlunoShell>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="rounded-3xl bg-white border p-6 shadow-sm hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {label}
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {value}
          </div>
        </div>

        <div className={`h-10 w-10 rounded-xl ${color} opacity-20`} />
      </div>
    </div>
  );
}