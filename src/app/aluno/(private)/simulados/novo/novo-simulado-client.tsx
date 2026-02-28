"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type Prova = { id: string; nome?: string; sigla?: string; ativo?: boolean; ordem?: number };

type QBQuestion = {
  id: string;
  isActive?: boolean;
  examType?: string; // TSA, TEA, ME...
  specialization?: string; // R1/R2/R3 (se você usar)
  themes?: string[]; // array
};

function toggle(list: string[], value: string) {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function cleanTitleFromParts(provasLabel: string, niveisLabel: string, temasLabel: string) {
  const head = "Simulado";
  const parts = [provasLabel, niveisLabel, temasLabel].filter((p) => {
    const t = p.trim().toLowerCase();
    return t && t !== "todos" && t !== "todas";
  });

  return parts.length ? `${head} • ${parts.join(" • ")}` : head;
}

function pillBase(active: boolean) {
  return cn(
    "px-3 py-2 rounded-full text-sm font-semibold border transition",
    active
      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
      : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
  );
}

function bigOption(active: boolean) {
  return cn(
    "rounded-2xl px-4 py-3 text-sm font-semibold border transition",
    active
      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
      : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
  );
}

export default function NovoSimuladoClient() {
  const router = useRouter();
  const user = auth.currentUser;

  const [provas, setProvas] = useState<Prova[]>([]);
  const [temas, setTemas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  const [selectedProvas, setSelectedProvas] = useState<string[]>([]);
  const [selectedNiveis, setSelectedNiveis] = useState<string[]>([]);
  const [selectedTemas, setSelectedTemas] = useState<string[]>([]);
  const [qtd, setQtd] = useState<number>(10);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr("");
      try {
        const pQ = query(
          collection(db, "provas"),
          where("ativo", "==", true),
          orderBy("ordem", "asc")
        );
        const pSnap = await getDocs(pQ);
        setProvas(pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

        const tSnap = await getDocs(query(collection(db, "temas"), limit(200)));
        const names = tSnap.docs
          .map((d) => (d.data() as any)?.nome)
          .filter(Boolean)
          .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
        setTemas(names);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message || "Falha ao carregar filtros.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const provasLabel = useMemo(() => {
    if (selectedProvas.length === 0) return "Todas";
    return selectedProvas
      .map((id) => provas.find((p) => p.id === id)?.sigla || provas.find((p) => p.id === id)?.nome || id)
      .join(", ");
  }, [selectedProvas, provas]);

  const niveisLabel = useMemo(() => (selectedNiveis.length === 0 ? "Todos" : selectedNiveis.join(", ")), [selectedNiveis]);
  const temasLabel = useMemo(() => (selectedTemas.length === 0 ? "Todos" : selectedTemas.join(", ")), [selectedTemas]);

  const title = useMemo(() => cleanTitleFromParts(provasLabel, niveisLabel, temasLabel), [provasLabel, niveisLabel, temasLabel]);

  function shuffle<T>(arr: T[]) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  async function fetchQuestionIds(): Promise<string[]> {
    // pega examTypes a partir das provas selecionadas (sigla/nome)
    const selectedExamTypes =
      selectedProvas.length === 0
        ? []
        : selectedProvas
            .map((id) => {
              const p = provas.find((x) => x.id === id);
              return (p?.sigla || p?.nome || "").trim();
            })
            .filter(Boolean);

    // query base
    // OBS: "in" aceita até 10 itens; se passar disso, cai no fallback.
    let baseSnap;

    if (selectedExamTypes.length > 0 && selectedExamTypes.length <= 10) {
      const qy = query(
        collection(db, "questionsBank"),
        where("isActive", "==", true),
        where("examType", "in", selectedExamTypes),
        limit(600)
      );
      baseSnap = await getDocs(qy);
    } else {
      const qy = query(
        collection(db, "questionsBank"),
        where("isActive", "==", true),
        limit(600)
      );
      baseSnap = await getDocs(qy);
    }

    const all: QBQuestion[] = baseSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    // filtros locais (pra não sofrer limitações do Firestore)
    const filtered = all.filter((q) => {
      if (selectedExamTypes.length > 0 && selectedExamTypes.length > 10) {
        // fallback: filtra local
        if (!selectedExamTypes.includes(String(q.examType || "").trim())) return false;
      }

      if (selectedNiveis.length > 0) {
        const spec = String((q as any)?.specialization ?? "").trim();
        if (!spec) return false;
        if (!selectedNiveis.includes(spec)) return false;
      }

      if (selectedTemas.length > 0) {
        const th = Array.isArray(q.themes) ? q.themes : [];
        const ok = selectedTemas.some((t) => th.includes(t));
        if (!ok) return false;
      }

      return true;
    });

    const picked = shuffle(filtered).slice(0, qtd).map((x) => x.id);

    // se não achou o suficiente, tenta completar com qualquer ativa (sem filtros)
    if (picked.length < qtd) {
      const missing = qtd - picked.length;
      const rest = shuffle(all.filter((x) => !picked.includes(x.id))).slice(0, missing).map((x) => x.id);
      return [...picked, ...rest].slice(0, qtd);
    }

    return picked;
  }

  const createSimulado = async () => {
    if (!user) return;

    setCreating(true);
    setErr("");

    try {
      const questionIds = await fetchQuestionIds();

      if (!questionIds.length) {
        setErr("Não encontrei questões para esses filtros. Tente remover algum filtro.");
        return;
      }

      const sessionRef = await addDoc(collection(db, "users", user.uid, "sessions"), {
        title,
        status: "in_progress",
        filters: {
          provas: selectedProvas,
          niveis: selectedNiveis,
          temas: selectedTemas,
        },
        questionIds,
        totalQuestions: questionIds.length,
        currentIndex: 0,
        answeredCount: 0,
        correctCount: 0,
        wrongCount: 0,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      router.push(`/aluno/simulados/${sessionRef.id}`);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Falha ao criar simulado.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white shadow-sm p-6">
        <div className="text-2xl font-black text-slate-900">Novo simulado</div>
        <div className="text-sm text-slate-500 mt-1">
          Selecione seus filtros e gere um simulado personalizado.
        </div>
      </div>

      {err ? (
        <div className="rounded-3xl border bg-white shadow-sm p-6">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 font-semibold">
            {err}
          </div>
        </div>
      ) : null}

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
                      className={pillBase(active)}
                      type="button"
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
                      className={pillBase(active)}
                      type="button"
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
                      className={bigOption(active)}
                      type="button"
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
                <div className="text-sm text-slate-500 mt-1">
                  Dica: escolha 1–3 temas para ficar mais direcionado.
                </div>
              </div>

              <button
                onClick={() => setSelectedTemas([])}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                type="button"
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
                    className={cn(pillBase(active), "max-w-full truncate")}
                    title={t}
                    type="button"
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={createSimulado}
                disabled={creating}
                className={cn(
                  "rounded-2xl px-6 py-3 text-sm font-semibold transition",
                  creating
                    ? "bg-slate-300 text-white cursor-not-allowed"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                )}
                type="button"
              >
                {creating ? "Criando…" : "Criar simulado"}
              </button>
            </div>

            <div className="mt-2 text-xs text-slate-500 truncate">{title}</div>
          </div>
        </>
      )}
    </div>
  );
}