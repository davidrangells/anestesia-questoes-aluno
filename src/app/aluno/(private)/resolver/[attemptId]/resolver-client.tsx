"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AlunoShell from "@/components/aluno/AlunoShell";
import {
  getAttempt,
  getQuestionById,
  confirmAnswer,
  setCurrentIndex,
  finishAttempt,
  type AttemptDoc,
} from "@/lib/simulados";

type Question = {
  id: string;
  pergunta?: string;
  title?: string;
  options: { id: string; text: string }[];
  correctOptionId?: string;
  respostaCorreta?: string;
  comentario?: string;
  explanation?: string;
};

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

export default function ResolverClient({ attemptId }: { attemptId: string }) {
  const router = useRouter();

  const [attempt, setAttempt] = useState<AttemptDoc | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setLoadError("");

    try {
      const a = await getAttempt(attemptId);

      const total = (a.totalQuestions ?? a.questionIds?.length ?? 0) || 0;
      if (!total || !a.questionIds?.length) {
        setAttempt(a);
        setQuestion(null);
        setLoadError("Este simulado não possui questões vinculadas.");
        return;
      }

      const currentIndex = Math.max(0, Math.min(a.currentIndex ?? 0, a.questionIds.length - 1));
      const qId = a.questionIds[currentIndex];

      if (!qId) {
        setAttempt({ ...a, currentIndex });
        setQuestion(null);
        setLoadError("Questão inválida nesta tentativa.");
        return;
      }

      const q = (await getQuestionById(qId)) as any;

      setAttempt({ ...a, currentIndex });
      setQuestion(q);
      setSelected(null);
      setConfirmed(false);
      setIsCorrect(null);
    } catch (e: any) {
      console.error(e);
      setLoadError(e?.message || "Falha ao carregar o simulado.");
    } finally {
      setLoading(false);
    }
  }

  const enunciado = useMemo(() => {
    return question?.pergunta ?? question?.title ?? "Pergunta não encontrada";
  }, [question]);

  const comentario = useMemo(() => {
    return question?.comentario ?? question?.explanation ?? "";
  }, [question]);

  const correctId = useMemo(() => {
    return (question?.correctOptionId ?? question?.respostaCorreta ?? "").trim() || null;
  }, [question]);

  const total = useMemo(() => {
    if (!attempt) return 0;
    return (attempt.totalQuestions ?? attempt.questionIds?.length ?? 0) || 0;
  }, [attempt]);

  const progress = useMemo(() => {
    if (!attempt || !total) return "";
    return `${attempt.currentIndex + 1} de ${total}`;
  }, [attempt, total]);

  async function handleConfirm() {
    if (!selected || !question) return;

    try {
      const result = await confirmAnswer({
        attemptId,
        question: { id: question.id, correctOptionId: correctId || "" },
        selectedOptionId: selected,
      });

      setIsCorrect(Boolean(result?.isCorrect));
      setConfirmed(true);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Falha ao confirmar resposta.");
    }
  }

  async function handleNext() {
    if (!attempt) return;

    const nextIndex = (attempt.currentIndex ?? 0) + 1;

    // terminou
    if (total && nextIndex >= total) {
      try {
        await finishAttempt(attemptId);
      } catch (e) {
        console.error(e);
      }
      router.push("/aluno/simulados");
      return;
    }

    try {
      await setCurrentIndex(attemptId, nextIndex);

      const newAttempt = await getAttempt(attemptId);
      const qId = newAttempt.questionIds?.[nextIndex];

      if (!qId) {
        setAttempt({ ...newAttempt, currentIndex: nextIndex });
        setQuestion(null);
        setLoadError("Questão inválida nesta tentativa.");
        return;
      }

      const q = (await getQuestionById(qId)) as any;

      setAttempt({ ...newAttempt, currentIndex: nextIndex });
      setQuestion(q);
      setSelected(null);
      setConfirmed(false);
      setIsCorrect(null);
      setLoadError("");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Falha ao avançar para a próxima questão.");
    }
  }

  if (loading) {
    return (
      <AlunoShell title="Simulado" subtitle="Carregando...">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/80 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="h-4 w-48 bg-slate-200 rounded-full animate-pulse" />
          <div className="mt-4 space-y-3">
            <div className="h-3 w-full bg-slate-200 rounded-full animate-pulse" />
            <div className="h-3 w-11/12 bg-slate-200 rounded-full animate-pulse" />
            <div className="h-3 w-10/12 bg-slate-200 rounded-full animate-pulse" />
          </div>
        </div>
      </AlunoShell>
    );
  }

  if (loadError) {
    return (
      <AlunoShell title="Simulado" subtitle="Erro ao carregar">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/80 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur space-y-4">
          <div className="text-sm font-semibold text-slate-900">Não foi possível carregar.</div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push("/aluno/simulados")}
              className="rounded-2xl px-4 py-3 border border-slate-200 bg-white text-sm font-semibold text-slate-900 hover:bg-slate-50 transition"
            >
              Voltar
            </button>
            <button
              onClick={load}
              className="rounded-2xl px-4 py-3 bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </AlunoShell>
    );
  }

  if (!question || !attempt) {
    return (
      <AlunoShell title="Simulado" subtitle="Erro ao carregar">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/80 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          Não foi possível carregar o simulado.
        </div>
      </AlunoShell>
    );
  }

  return (
    <AlunoShell
      title="Simulado"
      subtitle={`Questão ${progress}`}
      actions={
        <div className="flex items-center gap-2">
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
            {attempt.title ?? "Simulado"}
          </div>
          <div className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            {progress}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-[28px] border border-slate-200/70 bg-white/80 shadow-[0_16px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="px-6 py-6 border-b border-slate-200/60">
            <div className="text-xs font-semibold text-slate-500">Pergunta</div>
            <div className="mt-2 text-[15px] leading-7 text-slate-900">{enunciado}</div>
          </div>

          <div className="px-6 py-6">
            <div className="text-xs font-semibold text-slate-500 mb-3">Respostas</div>

            <div className="space-y-3">
              {question.options.map((opt) => {
                const isSelected = selected === opt.id;

                const showResult = confirmed && !!correctId;
                const isCorrectOpt = showResult && opt.id === correctId;
                const isWrongOpt = showResult && isSelected && opt.id !== correctId;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => !confirmed && setSelected(opt.id)}
                    className={cn(
                      "w-full text-left rounded-2xl border px-4 py-4 transition outline-none",
                      "focus:ring-2 focus:ring-slate-900/10",
                      !confirmed && "hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)]",
                      isSelected
                        ? "border-slate-900/50 bg-slate-900/5"
                        : "border-slate-200 bg-white hover:bg-slate-50",
                      isCorrectOpt && "border-emerald-300 bg-emerald-50",
                      isWrongOpt && "border-rose-300 bg-rose-50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border text-sm font-black",
                          isCorrectOpt
                            ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                            : isWrongOpt
                            ? "border-rose-200 bg-rose-100 text-rose-800"
                            : isSelected
                            ? "border-slate-900/40 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        )}
                      >
                        {opt.id}
                      </div>

                      <div className="min-w-0">
                        <div className="text-[14px] leading-6 text-slate-900">{opt.text}</div>

                        {isCorrectOpt && confirmed ? (
                          <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Correta
                          </div>
                        ) : null}

                        {isWrongOpt && confirmed ? (
                          <div className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-rose-700">
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            Sua resposta
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {!confirmed ? (
              <div className="mt-6">
                <button
                  disabled={!selected}
                  onClick={handleConfirm}
                  className={cn(
                    "w-full rounded-2xl py-3.5 text-sm font-semibold text-white transition",
                    "shadow-[0_14px_40px_rgba(2,6,23,0.18)]",
                    selected ? "bg-slate-900 hover:bg-slate-800" : "bg-slate-400 cursor-not-allowed"
                  )}
                >
                  Confirmar resposta
                </button>

                <div className="mt-3 text-xs text-slate-500">
                  Selecione uma alternativa e confirme para ver a correção.
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div
                  className={cn(
                    "rounded-2xl border px-4 py-4",
                    isCorrect ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
                  )}
                >
                  <div className="text-sm font-bold text-slate-900">Resultado</div>
                  <div className={cn("mt-1 text-sm font-semibold", isCorrect ? "text-emerald-700" : "text-rose-700")}>
                    {isCorrect ? "✅ Você acertou!" : "❌ Você errou."}
                  </div>
                  {correctId ? (
                    <div className="mt-1 text-sm text-slate-700">
                      Resposta correta: <strong>{correctId}</strong>
                    </div>
                  ) : null}
                </div>

                {comentario ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="text-sm font-bold text-slate-900">Comentário</div>
                    <div className="mt-2 text-sm leading-7 text-slate-700 whitespace-pre-line">{comentario}</div>
                  </div>
                ) : null}

                <button
                  onClick={handleNext}
                  className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition shadow-[0_14px_40px_rgba(2,6,23,0.18)]"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AlunoShell>
  );
}