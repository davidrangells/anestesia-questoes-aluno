"use client";

export default function AlunoTopHeader({
  onOpenMenu,
}: {
  onOpenMenu?: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="flex items-center justify-between px-6 sm:px-8 lg:px-10 py-4">

        {/* LADO ESQUERDO */}
        <div className="flex items-center gap-3">

          {/* BOTÃO MOBILE */}
          <button
            onClick={onOpenMenu}
            className="lg:hidden h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center text-lg bg-white"
          >
            ☰
          </button>

          <div>
            <div className="text-xs font-semibold text-slate-500">
              Área do Aluno
            </div>
            <div className="text-lg font-black text-slate-900">
              Anestesia Questões
            </div>
          </div>
        </div>

        {/* LADO DIREITO */}
        <div className="flex items-center gap-4">

          {/* Avatar */}
          <div className="h-10 w-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow">
            TE
          </div>
        </div>
      </div>
    </header>
  );
}