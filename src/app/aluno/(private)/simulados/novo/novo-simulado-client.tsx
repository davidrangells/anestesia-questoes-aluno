"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where,
  orderBy,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";

function toggle(list: string[], value: string) {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

type Prova = { id: string; nome?: string; sigla?: string; ativo?: boolean; ordem?: number };

type QuestionBankDoc = {
  id: string;
  isActive?: boolean;
  examType?: string; // TSA, TEA, ME
  specialization?: string; // R1/R2/R3 ou ""
  themes?: string[];
};

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function normalizeTitleParts(parts: string[]) {
  return parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .filter((p) => p.toLowerCase() !== "todos" && p.toLowerCase() !== "todas");
}

export default function NovoSimuladoClient() {
  const router = useRouter();
  const user = auth.currentUser;

  const [provas, setProvas] = useState<Prova[]>([]);
  const [temas, setTemas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [selectedProvas, setSelectedProvas] = useState<string[]>([]);
  const [selectedNiveis, setSelectedNiveis] = useState<string[]>([]);
  const [selectedTemas, setSelectedTemas] = useState<string[]>([]);
  const [qtd, setQtd] = useState<number>(10);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const pQ = query(
          collection(db, "provas"),
          where("ativo", "==", true),
          orderBy("ordem", "asc"),
          limit(50)
        );
        const pSnap = await getDocs(pQ);
        setProvas(pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

        try {
          const tSnap = await getDocs(query(collection(db, "temas"), limit(300)));
          const names = tSnap.docs
            .map((d) => (d.data() as any)?.nome)
            .filter(Boolean)
            .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
          setTemas(names);
        } catch {
          setTemas([]);
        }
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // ✅ examTypes aceitos (usa sigla se existir)
  const selectedExamTypes = useMemo(() => {
    if (!selectedProvas.length) return [];
    return selectedProvas
      .map((pid) => {
        const p = provas.find((x) => x.id === pid);
        return (p?.sigla || p?.id || "").toString().toUpperCase().trim();
      })
      .filter(Boolean);
  }, [selectedProvas, provas]);

  const title = useMemo(() => {
    const provasLabel =
      selectedExamTypes.length === 0 ? "Todas" : selectedExamTypes.join(", ");
    const niveisLabel = selectedNiveis.length === 0 ? "Todos" : selectedNiveis.join(", ");
    const temasLabel = selectedTemas.length === 0 ? "Todos" : selectedTemas.join(", ");
    return `Simulado • ${provasLabel} • ${niveisLabel} • ${temasLabel}`;
  }, [selectedExamTypes, selectedNiveis, selectedTemas]);

  const titleDisplay = useMemo(() => {
    const parts = title.split("•").map((p) => p.trim());
    const [main, ...rest] = parts;
    const cleaned = normalizeTitleParts(rest);
    return cleaned.length ? `${main} • ${cleaned.join(" • ")}` : main || "Simulado";
  }, [title]);

  async function pickQuestions(): Promise<string[]> {
    // ⚠️ 500 para teste; se sua base crescer, a gente otimiza para query + índices
    const snap = await getDocs(query(collection(db, "questionsBank"), limit(500)));

    const all: QuestionBankDoc[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    const activeOnly = all.filter((q) => q.isActive !== false);

    const filtered = activeOnly.filter((q) => {
      if (selectedExamTypes.length > 0) {
        const et = String(q.examType ?? "").toUpperCase().trim();
        if (!selectedExamTypes.includes(et)) return false;
      }

      if (selectedNiveis.length > 0) {
        const sp = String(q.specialization ?? "").trim();
        if (!selectedNiveis.includes(sp)) return false;
      }

      if (selectedTemas.length > 0) {
        const themes = Array.isArray(q.themes) ? q.themes : [];
        const has = selectedTemas.some((t) => themes.includes(t));
        if (!has) return false;
      }

      return true;
    });

    return shuffle(filtered).slice(0, qtd).map((q) => q.id);
  }

  const createSimulado = async () => {
    if (!user) return;

    setCreating(true);
    try {
      const questionIds = await pickQuestions();

      if (!questionIds.length) {
        alert("Nenhuma questão encontrada com esses filtros. Tente remover filtros.");
        return;
      }

      const sessionRef = await addDoc(collection(db, "users", user.uid, "sessions"), {
        title,
        titleDisplay,
        status: "in_progress",
        filters: {
          provas: selectedExamTypes,
          niveis: selectedNiveis,
          temas: selectedTemas,
        },
        questionIds, // ✅ ids do questionsBank
        totalQuestions: questionIds.length,
        currentIndex: 0,
        answeredCount: 0,
        correctCount: 0,
        wrongCount: 0,
        scorePercent: 0,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      router.push(`/aluno/simulados/${sessionRef.id}`);
    } catch (e) {
      console.error(e);
      alert("Não foi possível criar o simulado.");
    } finally {
      setCreating(false);
    }
  };

  const pillBase =
    "px-3 py-2 rounded-full text-sm font-semibold border transition max-w-full truncate";
  const pillOn = "bg-slate-900 text-white border-slate-900";
  const pillOff = "bg-white border-slate-200 text-slate-800 hover:bg-slate-50";

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
                      className={`${pillBase} ${active ? pillOn : pillOff}`}
                      type="button"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

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
                      className={`${pillBase} ${active ? pillOn : pillOff}`}
                      type="button"
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

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
                        active
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50",
                      ].join(" ")}
                      type="button"
                    >
                      {n} questões
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border bg-white shadow-sm p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-black text-slate-900">Seleção de Temas</div>
                <div className="text-sm text-slate-500 mt-1">
                  Dica: escolha 1–3 temas para ficar mais direcionado.
                </div>
              </div>

              <button
                onClick={() => setSelectedTemas([])}
                className="text-sm font-semibold text-slate-700 transition hover:text-slate-900"
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
                    className={`${pillBase} ${
                      active
                        ? "bg-indigo-100 border-indigo-200 text-indigo-900"
                        : pillOff
                    }`}
                    type="button"
                    title={t}
                  >
                    {t}
                  </button>
                );
              })}
              {temas.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhum tema carregado (ok por enquanto).</div>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={createSimulado}
                disabled={creating}
                className={!creating ? "w-full sm:w-auto" : "w-full bg-slate-300 text-slate-700 shadow-none hover:bg-slate-300 sm:w-auto"}
                type="button"
              >
                {creating ? "Criando…" : "Criar simulado"}
              </Button>
            </div>

            <div className="mt-2 text-xs text-slate-500 truncate">{titleDisplay}</div>
          </div>
        </>
      )}
    </div>
  );
}
