"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type SessionDoc = {
  id: string;
  status?: "in_progress" | "completed";
  questionIds?: string[];
  totalQuestions?: number;
  currentIndex?: number;
  answeredCount?: number;
  correctCount?: number;
  scorePercent?: number;
  answersMap?: Record<string, any>;
  updatedAt?: any;
  title?: string;
};

type QuestionDoc = {
  id: string;
  title?: string;
  statement?: string;
  enunciado?: string;
  pergunta?: string;
  options?: Array<{ id: string; text?: string; imageUrl?: string | null }>;
  correctOptionId?: string;
  correct?: string;
  gabarito?: string;
  explanation?: string | null;
  comentario?: string | null;
  imageUrl?: string | null;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

async function getQuestionById(questionId: string): Promise<QuestionDoc> {
  const ref = doc(db, "questionsBank", questionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Questão não encontrada.");
  return { id: snap.id, ...(snap.data() as any) };
}

export default function QuizClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [session, setSession] = useState<SessionDoc | null>(null);

  const [questions, setQuestions] = useState<QuestionDoc[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const shouldShowFeedback = confirmed || isSubmitting;

  const isFirst = currentIndex <= 0;

  // ✅ use totalQuestions/questionIds pra decidir “última”
  const totalFromSession = useMemo(() => {
    const tq = Number(session?.totalQuestions ?? 0) || 0;
    const ql = Array.isArray(session?.questionIds) ? session!.questionIds!.length : 0;
    return Math.max(tq, ql, questions.length);
  }, [session, questions.length]);

  const isLast = useMemo(() => {
    const total = totalFromSession || questions.length || 0;
    return total > 0 ? currentIndex >= total - 1 : false;
  }, [currentIndex, totalFromSession, questions.length]);

  const currentQuestion = useMemo(() => {
    return questions[currentIndex] ?? null;
  }, [questions, currentIndex]);

  const statement = useMemo(() => {
    return (
      currentQuestion?.pergunta ||
      currentQuestion?.enunciado ||
      currentQuestion?.statement ||
      currentQuestion?.title ||
      "Pergunta não encontrada"
    );
  }, [currentQuestion]);

  const correctId = useMemo(() => {
    return (
      currentQuestion?.correctOptionId ||
      currentQuestion?.correct ||
      currentQuestion?.gabarito ||
      null
    );
  }, [currentQuestion]);

  async function load() {
    const u = auth.currentUser;
    if (!u) {
      setErr("Você precisa estar logado.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const sessionRef = doc(db, "users", u.uid, "sessions", sessionId);
      const snap = await getDoc(sessionRef);
      if (!snap.exists()) throw new Error("Sessão não encontrada.");

      const sess = { id: snap.id, ...(snap.data() as any) } as SessionDoc;

      const questionIds = Array.isArray(sess.questionIds) ? sess.questionIds : [];
      if (!questionIds.length) {
        throw new Error(
          "Nenhuma questão foi carregada. Verifique se questionIds está preenchido na session."
        );
      }

      const loaded = await Promise.all(questionIds.map((qid) => getQuestionById(qid)));
      const ordered = questionIds
        .map((qid) => loaded.find((q) => q.id === qid))
        .filter(Boolean) as QuestionDoc[];

      setSession(sess);
      setQuestions(ordered);

      const idx = Number(sess.currentIndex ?? 0) || 0;
      setCurrentIndex(Math.min(Math.max(0, idx), Math.max(0, ordered.length - 1)));

      // reseta estado da UI
      setSelectedOptionId(null);
      setConfirmed(false);
      setIsCorrect(null);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Falha ao carregar simulado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistIndex(nextIndex: number) {
    const u = auth.currentUser;
    if (!u) return;

    await updateDoc(doc(db, "users", u.uid, "sessions", sessionId), {
      currentIndex: nextIndex,
      updatedAt: serverTimestamp(),
    });
  }

  async function onConfirm() {
    if (!session || !currentQuestion || !selectedOptionId) return;

    const u = auth.currentUser;
    if (!u) return;

    setIsSubmitting(true);

    try {
      const chosen = safeStr(selectedOptionId);
      const correct = safeStr(correctId);
      const ok = !!(correct && chosen && correct === chosen);

      // answersMap inline
      const nextAnsweredCount = Number(session.answeredCount ?? 0) + 1;
      const nextCorrectCount = Number(session.correctCount ?? 0) + (ok ? 1 : 0);

      const total = Number(session.totalQuestions ?? session.questionIds?.length ?? 0) || 0;
      const scorePercent = total > 0 ? Math.round((nextCorrectCount / total) * 100) : 0;

      await updateDoc(doc(db, "users", u.uid, "sessions", sessionId), {
        answeredCount: nextAnsweredCount,
        correctCount: nextCorrectCount,
        scorePercent,
        updatedAt: serverTimestamp(),
        [`answersMap.${currentQuestion.id}`]: {
          selectedOptionId: chosen,
          isCorrect: ok,
          answeredAt: serverTimestamp(),
        },
      });

      setSession((prev) =>
        prev
          ? {
              ...prev,
              answeredCount: nextAnsweredCount,
              correctCount: nextCorrectCount,
              scorePercent,
              answersMap: {
                ...(prev.answersMap ?? {}),
                [currentQuestion.id]: {
                  selectedOptionId: chosen,
                  isCorrect: ok,
                  answeredAt: new Date(),
                },
              },
            }
          : prev
      );

      setConfirmed(true);
      setIsCorrect(ok);
    } catch (e) {
      console.error(e);
      setErr("Não foi possível confirmar sua resposta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function onPrev() {
    if (isFirst) return;
    const next = currentIndex - 1;
    setCurrentIndex(next);
    persistIndex(next);

    setSelectedOptionId(null);
    setConfirmed(false);
    setIsCorrect(null);
  }

  function onNext() {
    if (isLast) return;
    const next = currentIndex + 1;
    setCurrentIndex(next);
    persistIndex(next);

    setSelectedOptionId(null);
    setConfirmed(false);
    setIsCorrect(null);
  }

  async function onFinish() {
    const u = auth.currentUser;
    if (!u || !session) return;

    setIsFinishing(true);
    try {
      await updateDoc(doc(db, "users", u.uid, "sessions", sessionId), {
        status: "completed",
        updatedAt: serverTimestamp(),
      });

      router.push(`/aluno/simulados/${sessionId}/resultado`);
    } catch (e) {
      console.error(e);
      setErr("Não foi possível finalizar o simulado.");
    } finally {
      setIsFinishing(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-black text-slate-900">Simulado</div>
        </CardHeader>
        <CardBody className="text-slate-600">Carregando…</CardBody>
      </Card>
    );
  }

  if (err) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-black text-slate-900">Simulado</div>
        </CardHeader>
        <CardBody>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {err}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/aluno/simulados")}>
              Voltar
            </Button>
            <Button onClick={load}>Tentar novamente</Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!session || !currentQuestion) return null;

  const canFinalize = isLast; // ✅ sempre “Finalizar” na última
  const finalizeDisabled = !confirmed || isSubmitting || isFinishing;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="text-xs font-semibold text-slate-500">Pergunta</div>
          <div className="mt-2 text-[15px] leading-7 text-slate-900">{statement}</div>
        </CardHeader>

        <CardBody className="space-y-3">
          {currentQuestion.options?.map((opt) => {
            const isSelected = selectedOptionId === opt.id;

            const showResult = shouldShowFeedback && !!correctId;
            const isCorrectOpt = showResult && opt.id === correctId;
            const isWrongOpt = showResult && isSelected && opt.id !== correctId;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => !confirmed && setSelectedOptionId(opt.id)}
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
                    <div className="text-[14px] leading-6 text-slate-900">
                      {opt.text ?? ""}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {!confirmed ? (
            <div className="pt-3">
              <Button
                className="w-full"
                disabled={!selectedOptionId || isSubmitting}
                onClick={onConfirm}
              >
                {isSubmitting ? "Confirmando…" : "Confirmar resposta"}
              </Button>
            </div>
          ) : (
            <div className="pt-3">
              <div
                className={cn(
                  "rounded-2xl border px-4 py-3",
                  isCorrect ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
                )}
              >
                <div className="text-sm font-bold text-slate-900">Resultado</div>
                <div className={cn("mt-1 text-sm font-semibold", isCorrect ? "text-emerald-700" : "text-rose-700")}>
                  {isCorrect ? "✅ Você acertou!" : "❌ Você errou."}
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={onPrev} disabled={isFirst}>
              ← Anterior
            </Button>

            {/* ✅ sempre mostra “Finalizar” na última */}
            {canFinalize ? (
              <Button onClick={onFinish} disabled={finalizeDisabled}>
                {isFinishing ? "Finalizando…" : "Finalizar →"}
              </Button>
            ) : (
              <Button variant="secondary" onClick={onNext} disabled={!confirmed || isLast}>
                Próxima →
              </Button>
            )}
          </div>

          {confirmed ? (
            <div className="text-sm font-semibold text-emerald-700">
              Resposta confirmada ✓
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}