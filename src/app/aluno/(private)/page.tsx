// src/app/aluno/(private)/page.tsx
import AlunoShell from "@/components/aluno/AlunoShell";

export default function Page() {
  return (
    <AlunoShell title="Dashboard" subtitle="Visão geral do seu desempenho">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white border p-5">
          <div className="text-sm text-slate-500">Progresso</div>
          <div className="text-2xl font-bold text-slate-900">—</div>
        </div>
        <div className="rounded-2xl bg-white border p-5">
          <div className="text-sm text-slate-500">Questões resolvidas</div>
          <div className="text-2xl font-bold text-slate-900">—</div>
        </div>
        <div className="rounded-2xl bg-white border p-5">
          <div className="text-sm text-slate-500">Aproveitamento</div>
          <div className="text-2xl font-bold text-slate-900">—</div>
        </div>
      </div>
    </AlunoShell>
  );
}