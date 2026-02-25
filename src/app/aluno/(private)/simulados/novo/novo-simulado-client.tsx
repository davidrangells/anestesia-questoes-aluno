"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

function toggle(list: string[], value: string) {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

type Prova = { id: string; nome?: string; sigla?: string; ativo?: boolean; ordem?: number };

export default function NovoSimuladoClient() {
  const router = useRouter();
  const user = auth.currentUser;

  const [provas, setProvas] = useState<Prova[]>([]);
  const [temas, setTemas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ NUNCA undefined
  const [selectedProvas, setSelectedProvas] = useState<string[]>([]);
  const [selectedNiveis, setSelectedNiveis] = useState<string[]>([]);
  const [selectedTemas, setSelectedTemas] = useState<string[]>([]);
  const [qtd, setQtd] = useState<number>(10);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // Provas ativas ordenadas
        const pQ = query(collection(db, "provas"), where("ativo", "==", true), orderBy("ordem", "asc"));
        const pSnap = await getDocs(pQ);
        setProvas(pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

        // Temas (se você usa coleção "temas")
        const tSnap = await getDocs(query(collection(db, "temas"), limit(200)));
        const names = tSnap.docs
          .map((d) => (d.data() as any)?.nome)
          .filter(Boolean)
          .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
        setTemas(names);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const title = useMemo(() => {
    const provasLabel =
      selectedProvas.length === 0
        ? "Todas"
        : selectedProvas
            .map((id) => provas.find((p) => p.id === id)?.sigla || provas.find((p) => p.id === id)?.nome || id)
            .join(", ");

    const niveisLabel = selectedNiveis.length === 0 ? "Todos" : selectedNiveis.join(", ");
    const temasLabel = selectedTemas.length === 0 ? "Todos" : selectedTemas.join(", ");

    return `Simulado • ${provasLabel} • ${niveisLabel} • ${temasLabel}`;
  }, [selectedProvas, selectedNiveis, selectedTemas, provas]);

  const createSimulado = async () => {
    if (!user) return;

    // (Aqui você vai colocar a mesma lógica do app: selecionar questionIds e salvar session)
    // Por enquanto vamos criar a sessão “vazia” para você testar o fluxo e navegar.
    const sessionRef = await addDoc(collection(db, "users", user.uid, "sessions"), {
      title,
      status: "in_progress",
      filters: {
        provas: selectedProvas,
        niveis: selectedNiveis,
        temas: selectedTemas,
      },
      totalQuestions: qtd,
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      // questionIds: [...]  (vamos preencher no passo do Quiz, igual o app)
    });

    router.push(`/aluno/simulados/${sessionRef.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white shadow-sm p-6">
        <div className="text-2xl font-black text-slate-900">Novo simulado</div>
        <div className="text-sm text-slate-500 mt-1">
          Selecione seus filtros e gere um simulado personalizado.
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Provas */}
            <div className="rounded-3xl border bg-white shadow-sm p-6">
              <div className="font-black text-slate-900">Seleção de provas</div>
              <div className="text-xs text-slate-500 mt-1">Sem filtro = todas</div>

              <div className="mt-4 flex flex-wrap gap-2">
                {provas.map((p) => {
                  const active = selectedProvas.includes(p.id);
                  const label = p.sigla || p.nome || p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProvas((prev) => toggle(prev, p.id))}
                      className={[
                        "px-3 py-2 rounded-full text-sm font-semibold border transition",
                        active ? "bg-violet-100 border-violet-200 text-violet-800" : "hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Níveis */}
            <div className="rounded-3xl border bg-white shadow-sm p-6">
              <div className="font-black text-slate-900">Seleção de Especialização</div>
              <div className="text-xs text-slate-500 mt-1">Sem filtro = todos</div>

              <div className="mt-4 flex flex-wrap gap-2">
                {["R1", "R2", "R3"].map((n) => {
                  const active = selectedNiveis.includes(n);
                  return (
                    <button
                      key={n}
                      onClick={() => setSelectedNiveis((prev) => toggle(prev, n))}
                      className={[
                        "px-3 py-2 rounded-full text-sm font-semibold border transition",
                        active ? "bg-violet-100 border-violet-200 text-violet-800" : "hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantidade */}
            <div className="rounded-3xl border bg-white shadow-sm p-6">
              <div className="font-black text-slate-900">Quantidade de questões</div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[10, 20, 30, 50].map((n) => {
                  const active = qtd === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setQtd(n)}
                      className={[
                        "rounded-2xl px-4 py-3 text-sm font-semibold border transition",
                        active ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {n} questões
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Temas */}
          <div className="rounded-3xl border bg-white shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-black text-slate-900">Seleção de Temas</div>
                <div className="text-sm text-slate-500 mt-1">Dica: escolha 1–3 temas para ficar mais direcionado.</div>
              </div>

              <button
                onClick={() => setSelectedTemas([])}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Limpar
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {temas.map((t) => {
                const active = selectedTemas.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => setSelectedTemas((prev) => toggle(prev, t))}
                    className={[
                      "px-3 py-2 rounded-full text-sm font-semibold border transition max-w-full truncate",
                      active ? "bg-violet-100 border-violet-200 text-violet-800" : "hover:bg-slate-50",
                    ].join(" ")}
                    title={t}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={createSimulado}
                className="rounded-2xl bg-blue-600 text-white px-6 py-3 text-sm font-semibold hover:bg-blue-500"
              >
                Criar simulado
              </button>
            </div>

            <div className="mt-2 text-xs text-slate-500 truncate">{title}</div>
          </div>
        </>
      )}
    </div>
  );
}