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
          qbSnap.docs.forEach((d) => {
            const data = d.data() as Omit<QuestionBankDoc, "id">;
            const themesFromQuestion = extractThemes({ id: d.id, ...data });
            themesFromQuestion.forEach((theme) => collectedThemes.add(theme));
          });
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

  async function pickQuestions(): Promise<string[]> {
    const snap = await getDocs(collection(db, "questionsBank"));

    const all: QuestionBankDoc[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<QuestionBankDoc, "id">),
    }));

    const activeOnly = all.filter((q) => q.isActive !== false);

    const filtered = activeOnly.filter((q) => {
      if (selectedExamTokens.length > 0) {
        const tokens = extractExamTokens(q);
        if (!tokens.some((token) => selectedExamTokens.includes(token))) return false;
      }

      if (selectedNiveis.length > 0) {
        const levels = extractLevelTokens(q);
        if (!levels.some((level) => selectedNiveis.includes(level))) return false;
      }

      if (selectedTemas.length > 0) {
        const themes = extractThemes(q);
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

            <div className="rounded-3xl border bg-white shadow-sm p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="font-black text-slate-900 dark:text-slate-100">Seleção de Especialização</div>
              <div className="text-xs text-slate-500 mt-1 dark:text-slate-400">Sem filtro = todos</div>

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
                onClick={() => setSelectedTemas([])}
                className="text-sm font-semibold text-slate-700 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
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
                    className={`${pillBase} ${active ? pillOn : pillOff}`}
                    type="button"
                    title={t}
                  >
                    {t}
                  </button>
                );
              })}
              {temas.length === 0 ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Nenhum tema carregado (ok por enquanto).</div>
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

            <div className="mt-2 text-xs text-slate-500 truncate dark:text-slate-400">{titleDisplay}</div>
          </div>
        </>
      )}
    </div>
  );
}
