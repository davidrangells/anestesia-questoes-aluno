"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";

function toggle(list: string[], value: string) {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

type Prova = { id: string; nome?: string; sigla?: string; ativo?: boolean; ordem?: number };

type TemaDoc = {
  nome?: string;
  tema?: string;
  title?: string;
  ativo?: boolean;
};

function hasText(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type QuestionBankDoc = {
  id: string;
  isActive?: unknown;
  examType?: unknown;
  specialization?: unknown;
  themes?: unknown;
  temas?: unknown;
  tema?: unknown;
  theme?: unknown;
  topic?: unknown;
  prova?: unknown;
  provaId?: unknown;
  provaSigla?: unknown;
  nivel?: unknown;
  level?: unknown;
  options?: Array<{ id?: unknown }>;
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

function norm(v: unknown) {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function uniq(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function extractThemes(q: QuestionBankDoc): string[] {
  const fromArrays = [
    ...toStringArray(q.themes),
    ...toStringArray(q.temas),
  ];
  const single = [q.tema, q.theme, q.topic]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  return uniq([...fromArrays, ...single]);
}

function extractExamTokens(q: QuestionBankDoc): string[] {
  return uniq(
    [q.examType, q.prova, q.provaSigla, q.provaId]
      .map(norm)
      .filter(Boolean)
  );
}

function extractLevelTokens(q: QuestionBankDoc): string[] {
  return uniq(
    [q.specialization, q.nivel, q.level]
      .map(norm)
      .filter(Boolean)
  );
}

export default function NovoSimuladoClient() {
  const router = useRouter();
  const user = auth.currentUser;

  const [provas, setProvas] = useState<Prova[]>([]);
  const [temas, setTemas] = useState<string[]>([]);
  const [questionsPool, setQuestionsPool] = useState<QuestionBankDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [selectedProvas, setSelectedProvas] = useState<string[]>([]);
  const [selectedNiveis, setSelectedNiveis] = useState<string[]>([]);
  const [selectedTemas, setSelectedTemas] = useState<string[]>([]);
  const [qtd, setQtd] = useState<number>(10);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [themeQuery, setThemeQuery] = useState("");

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
        setProvas(pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Prova, "id">) })));

        const collectedThemes = new Set<string>();

        try {
          const tSnap = await getDocs(collection(db, "temas"));
          tSnap.docs.forEach((d) => {
            const data = d.data() as TemaDoc;
            if (data.ativo === false) return;
            const label = data.nome ?? data.tema ?? data.title;
            if (hasText(label)) collectedThemes.add(label.trim());
          });
        } catch {
          // fallback abaixo via questionsBank
        }

        try {
          const qbSnap = await getDocs(collection(db, "questionsBank"));
          const pool: QuestionBankDoc[] = [];
          qbSnap.docs.forEach((d) => {
            const data = d.data() as Omit<QuestionBankDoc, "id">;
            const q = { id: d.id, ...data };
            pool.push(q);
            const themesFromQuestion = extractThemes(q);
            themesFromQuestion.forEach((theme) => collectedThemes.add(theme));
          });
          setQuestionsPool(pool);
        } catch {
          // mantém os temas já coletados da coleção "temas"
        }

        setTemas(
          Array.from(collectedThemes).sort((a, b) => a.localeCompare(b, "pt-BR"))
        );
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // ✅ examTypes aceitos (usa sigla se existir)
  const selectedExamTokens = useMemo(() => {
    if (!selectedProvas.length) return [];
    return uniq(
      selectedProvas.flatMap((pid) => {
        const p = provas.find((x) => x.id === pid);
        return [p?.sigla, p?.id, p?.nome].map(norm).filter(Boolean);
      })
    );
  }, [selectedProvas, provas]);

  const title = useMemo(() => {
    const provasLabel = selectedProvas.length
      ? selectedProvas
          .map((pid) => {
            const p = provas.find((x) => x.id === pid);
            return String(p?.sigla || p?.nome || p?.id || "").trim();
          })
          .filter(Boolean)
          .join(", ")
      : "Todas";
    const niveisLabel = selectedNiveis.length === 0 ? "Todos" : selectedNiveis.join(", ");
    const temasLabel = selectedTemas.length === 0 ? "Todos" : selectedTemas.join(", ");
    return `Simulado • ${provasLabel} • ${niveisLabel} • ${temasLabel}`;
  }, [selectedNiveis, selectedProvas, selectedTemas, provas]);

  const titleDisplay = useMemo(() => {
    const parts = title.split("•").map((p) => p.trim());
    const [main, ...rest] = parts;
    const cleaned = normalizeTitleParts(rest);
    return cleaned.length ? `${main} • ${cleaned.join(" • ")}` : main || "Simulado";
  }, [title]);

  const filteredTemas = useMemo(() => {
    const q = themeQuery.trim().toLowerCase();
    if (!q) return temas;
    return temas.filter((t) => t.toLowerCase().includes(q));
  }, [temas, themeQuery]);

  const activeQuestions = useMemo(
    () => questionsPool.filter((q) => q.isActive !== false),
    [questionsPool]
  );

  function matchesFilters(
    q: QuestionBankDoc,
    {
      examTokens,
      niveis,
      temasSelecionados,
    }: {
      examTokens: string[];
      niveis: string[];
      temasSelecionados: string[];
    }
  ) {
    if (examTokens.length > 0) {
      const tokens = extractExamTokens(q);
      if (!tokens.some((token) => examTokens.includes(token))) return false;
    }

    if (niveis.length > 0) {
      const levels = extractLevelTokens(q);
      if (!levels.some((level) => niveis.includes(level))) return false;
    }

    if (temasSelecionados.length > 0) {
      const qThemes = extractThemes(q);
      if (!temasSelecionados.some((t) => qThemes.includes(t))) return false;
    }

    return true;
  }

  const availableQuestions = useMemo(
    () =>
      activeQuestions.filter((q) =>
        matchesFilters(q, {
          examTokens: selectedExamTokens,
          niveis: selectedNiveis,
          temasSelecionados: selectedTemas,
        })
      ),
    [activeQuestions, selectedExamTokens, selectedNiveis, selectedTemas]
  );

  const availableCount = availableQuestions.length;

  const provaCounts = useMemo(() => {
    const entries = provas.map((p) => {
      const provaTokens = [p.sigla, p.id, p.nome].map(norm).filter(Boolean);
      const count = activeQuestions.filter(
        (q) =>
          matchesFilters(q, {
            examTokens: provaTokens,
            niveis: selectedNiveis,
            temasSelecionados: selectedTemas,
          })
      ).length;
      return [p.id, count] as const;
    });

    return Object.fromEntries(entries) as Record<string, number>;
  }, [provas, activeQuestions, selectedNiveis, selectedTemas]);

  const nivelCounts = useMemo(() => {
    const entries = ["R1", "R2", "R3"].map((nivel) => {
      const count = activeQuestions.filter((q) =>
        matchesFilters(q, {
          examTokens: selectedExamTokens,
          niveis: [nivel],
          temasSelecionados: selectedTemas,
        })
      ).length;
      return [nivel, count] as const;
    });

    return Object.fromEntries(entries) as Record<string, number>;
  }, [activeQuestions, selectedExamTokens, selectedTemas]);

  const temaCounts = useMemo(() => {
    const entries = temas.map((tema) => {
      const count = activeQuestions.filter((q) =>
        matchesFilters(q, {
          examTokens: selectedExamTokens,
          niveis: selectedNiveis,
          temasSelecionados: [tema],
        })
      ).length;
      return [tema, count] as const;
    });

    return Object.fromEntries(entries) as Record<string, number>;
  }, [temas, activeQuestions, selectedExamTokens, selectedNiveis]);

  async function pickQuestions(): Promise<QuestionBankDoc[]> {
    const source =
      questionsPool.length > 0
        ? questionsPool
        : (
            await getDocs(collection(db, "questionsBank"))
          ).docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<QuestionBankDoc, "id">),
          }));

    const filtered = source
      .filter((q) => q.isActive !== false)
      .filter((q) =>
        matchesFilters(q, {
          examTokens: selectedExamTokens,
          niveis: selectedNiveis,
          temasSelecionados: selectedTemas,
        })
      );

    return shuffle(filtered).slice(0, qtd);
  }

  const createSimulado = async () => {
    if (!user) return;

    setCreating(true);
    try {
      const selectedQuestions = await pickQuestions();
      const questionIds = selectedQuestions.map((question) => question.id);
      // Mantemos a exibição em ordem fixa A..E no quiz; não salvar map de embaralhamento aqui.

      if (!questionIds.length) {
        return;
      }

      const sessionRef = await addDoc(collection(db, "users", user.uid, "sessions"), {
        title,
        titleDisplay,
        status: "in_progress",
        filters: {
          provas: selectedExamTokens,
          provaIds: selectedProvas,
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
  const pillOn = "bg-slate-900 text-white border-slate-900 dark:bg-blue-500 dark:border-blue-500";
  const pillOff = "bg-white border-slate-200 text-slate-800 hover:bg-slate-50";
  const canCreate = !creating && availableCount > 0;
  const effectiveQuestionCount = Math.min(qtd, availableCount);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border bg-white shadow-sm p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-2xl font-black text-slate-900 dark:text-slate-100">Novo simulado</div>
        <div className="text-sm text-slate-500 mt-1 dark:text-slate-400">
          Selecione seus filtros e gere um simulado personalizado.
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">Carregando…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-3xl border bg-white shadow-sm p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="font-black text-slate-900 dark:text-slate-100">Seleção de provas</div>
              <div className="text-xs text-slate-500 mt-1 dark:text-slate-400">Sem filtro = todas</div>

              <div className="mt-4 flex flex-wrap gap-2">
                {provas.map((p) => {
                  const active = selectedProvas.includes(p.id);
                  const label = p.sigla || p.nome || p.id;
                  const count = provaCounts[p.id] ?? 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProvas((prev) => toggle(prev, p.id))}
                      disabled={!active && count === 0}
                      className={`${pillBase} ${active ? pillOn : pillOff} ${!active && count === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                      type="button"
                    >
                      {label} <span className="ml-1 opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border bg-white shadow-sm p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="font-black text-slate-900 dark:text-slate-100">Seleção de Especialização</div>
              <div className="text-xs text-slate-500 mt-1 dark:text-slate-400">Sem filtro = todos</div>

              <div className="mt-4 flex flex-wrap gap-2">
                {["R1", "R2", "R3"].map((n) => {
                  const active = selectedNiveis.includes(n);
                  const count = nivelCounts[n] ?? 0;
                  return (
                    <button
                      key={n}
                      onClick={() => setSelectedNiveis((prev) => toggle(prev, n))}
                      disabled={!active && count === 0}
                      className={`${pillBase} ${active ? pillOn : pillOff} ${!active && count === 0 ? "cursor-not-allowed opacity-50" : ""}`}
                      type="button"
                    >
                      {n} <span className="ml-1 opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border bg-white shadow-sm p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="font-black text-slate-900 dark:text-slate-100">Quantidade de questões</div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[10, 20, 30, 50].map((n) => {
                  const active = qtd === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setQtd(n)}
                      className={[
                        "rounded-2xl px-4 py-3 text-sm font-semibold border transition",
                        active ? pillOn : pillOff,
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

          <div className="rounded-3xl border bg-white shadow-sm p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-black text-slate-900 dark:text-slate-100">Seleção de Temas</div>
                <div className="text-sm text-slate-500 mt-1 dark:text-slate-400">
                  Dica: escolha 1–3 temas para ficar mais direcionado.
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedTemas([]);
                  setThemeQuery("");
                }}
                className="text-sm font-semibold text-slate-700 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                type="button"
              >
                Limpar
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => setThemePickerOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <span className="truncate">
                  {selectedTemas.length
                    ? `${selectedTemas.length} tema(s) selecionado(s)`
                    : "Selecionar temas"}
                </span>
                <span className="ml-3 shrink-0 text-slate-500 dark:text-slate-400">
                  {themePickerOpen ? "▲" : "▼"}
                </span>
              </button>

              {themePickerOpen ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                  <input
                    type="text"
                    value={themeQuery}
                    onChange={(e) => setThemeQuery(e.target.value)}
                    placeholder="Buscar tema..."
                    className="ui-input"
                  />

                  <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    {filteredTemas.length ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredTemas.map((t) => {
                          const active = selectedTemas.includes(t);
                          const count = temaCounts[t] ?? 0;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setSelectedTemas((prev) => toggle(prev, t))}
                              disabled={!active && count === 0}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <span className="min-w-0 truncate">
                                {t} <span className="opacity-70">({count})</span>
                              </span>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                                  active
                                    ? "border-blue-500 bg-blue-500 text-white"
                                    : count === 0
                                    ? "border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                                    : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                                }`}
                              >
                                {active ? "Selecionado" : count === 0 ? "Sem questões" : "Selecionar"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                        Nenhum tema encontrado.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {selectedTemas.length ? (
                <div className="flex flex-wrap gap-2">
                  {selectedTemas.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTemas((prev) => prev.filter((x) => x !== t))}
                      className="inline-flex items-center gap-2 rounded-full border border-blue-500 bg-blue-500 px-3 py-1 text-xs font-semibold text-white"
                      title={`Remover ${t}`}
                    >
                      <span className="max-w-[220px] truncate">{t}</span>
                      <span>✕</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {temas.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Nenhum tema carregado (ok por enquanto).</div>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                onClick={createSimulado}
                disabled={!canCreate}
                className={!creating ? "w-full sm:w-auto" : "w-full bg-slate-300 text-slate-700 shadow-none hover:bg-slate-300 sm:w-auto"}
                type="button"
              >
                {creating ? "Criando…" : "Criar simulado"}
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <div className="font-semibold text-slate-800 dark:text-slate-100">
                Disponíveis com os filtros: {availableCount}
              </div>
              <div className="mt-1 text-slate-600 dark:text-slate-300">
                Este simulado será criado com {effectiveQuestionCount} questão(ões).
                {availableCount === 0 ? " Ajuste os filtros para continuar." : ""}
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-500 truncate dark:text-slate-400">{titleDisplay}</div>
          </div>
        </>
      )}
    </div>
  );
}
