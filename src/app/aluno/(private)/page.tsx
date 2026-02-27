// src/app/aluno/(private)/page.tsx
export default function Page() {
  return (
    <div className="space-y-6">
      {/* Título da página (o TopHeader já mostra “Área do Aluno” lá em cima) */}
      <div>
        <div className="text-sm font-semibold text-slate-500">Dashboard</div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
          Visão geral
        </h1>
        <p className="mt-1 text-slate-600">
          Acompanhe seu desempenho e evolução.
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white border border-slate-200/70 p-5 shadow-sm">
          <div className="text-sm text-slate-500">Progresso</div>
          <div className="mt-2 text-2xl font-black text-slate-900">—</div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/70 p-5 shadow-sm">
          <div className="text-sm text-slate-500">Questões resolvidas</div>
          <div className="mt-2 text-2xl font-black text-slate-900">—</div>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/70 p-5 shadow-sm">
          <div className="text-sm text-slate-500">Aproveitamento</div>
          <div className="mt-2 text-2xl font-black text-slate-900">—</div>
        </div>
      </div>
    </div>
  );
}