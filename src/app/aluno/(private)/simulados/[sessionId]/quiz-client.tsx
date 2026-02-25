"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  increment,
  runTransaction,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Question = {
  id: string;
  prompt?: string;
  imageUrl?: string | null;
  options: Array<{ id: string; text?: string; imageUrl?: string | null }>;
  correctOptionId: string;
  explanation?: string | null;
};

type AnswerEntry = {
  selectedOptionId: string;
  isCorrect: boolean;
  answeredAt?: any;
};

type SessionDoc = {
  title?: string;
  status?: "in_progress" | "completed";
  totalQuestions?: number;
  currentIndex?: number;
  correctCount?: number;
  answeredCount?: number;
  scorePercent?: number;
  attemptId?: string;
  questionIds?: string[];
  answersMap?: Record<string, AnswerEntry>;
};

export default function QuizClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionDoc | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<string>("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const [imgModalUrl, setImgModalUrl] = useState("");

  const user = auth.currentUser;

  const currentIndex = useMemo(() => session?.currentIndex ?? 0, [session?.currentIndex]);
  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);

  const total = useMemo(() => session?.totalQuestions ?? questions.length, [session?.totalQuestions, questions.length]);
  const answered = useMemo(() => session?.answeredCount ?? 0, [session?.answeredCount]);
  const correct = useMemo(() => session?.correctCount ?? 0, [session?.correctCount]);

  const canFinalize = useMemo(() => total > 0 && answered >= total, [answered, total]);

  const isCorrectSelected = useMemo(() => {
    if (!confirmed || !currentQuestion) return false;
    return selectedId === currentQuestion.correctOptionId;
  }, [confirmed, currentQuestion, selectedId]);

  function applyAnswerState(sess: SessionDoc | null, q?: Question) {
    if (!sess || !q) {
      setSelectedId("");
      setConfirmed(false);
      return;
    }
    const entry = sess.answersMap?.[q.id];
    if (entry) {
      setSelectedId(entry.selectedOptionId);
      setConfirmed(true);
    } else {
      setSelectedId("");
      setConfirmed(false);
    }
  }

  async function load() {
    const u = auth.currentUser;
    if (!u) {
      setLoading(false);
      setError("Você precisa estar logado.");
      return;
    }

    if (!sessionId || typeof sessionId !== "string") {
      setLoading(false);
      setError("sessionId inválido.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const sessRef = doc(db, "users", u.uid, "sessions", sessionId);
      const sessSnap = await getDoc(sessRef);

      if (!sessSnap.exists()) {
        setError("Simulado não encontrado.");
        setSession(null);
        setQuestions([]);
        return;
      }

      const sess = sessSnap.data() as SessionDoc;
      setSession(sess);

      const questionIds = Array.isArray(sess.questionIds) ? sess.questionIds : [];
      if (!questionIds.length) {
        setError("Este simulado não possui questões vinculadas (questionIds vazio).");
        setQuestions([]);
        return;
      }

      const qs: Question[] = [];
      for (const qid of questionIds) {
        // ✅ seu banco real: questionsBank
        const qRef = doc(db, "questionsBank", qid);
        const qSnap = await getDoc(qRef);

        if (qSnap.exists()) {
          const q = qSnap.data() as any;

          qs.push({
            id: qid,
            prompt: q.prompt || "",
            imageUrl: q.imageUrl || null,
            options: Array.isArray(q.options) ? q.options : [],
            correctOptionId: q.correctOptionId || "",
            explanation: q.explanation || null,
          });
        }
      }

      if (!qs.length) {
        setError("Nenhuma questão foi carregada. Verifique se os IDs existem em /questionsBank.");
        setQuestions([]);
        return;
      }

      setQuestions(qs);

      // ✅ aplica estado (se já tinha respondido)
      applyAnswerState(sess, qs[sess.currentIndex ?? 0]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Falha ao carregar simulado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    applyAnswerState(session, currentQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, session?.answersMap, questions.length]);

  function goPrev() {
    if (!user || !session) return;
    const next = Math.max(0, (session.currentIndex ?? 0) - 1);

    setSession({ ...session, currentIndex: next });
    setError("");

    applyAnswerState(session, questions[next]);

    updateDoc(doc(db, "users", user.uid, "sessions", sessionId), {
      currentIndex: next,
      updatedAt: serverTimestamp(),
    }).catch(console.error);
  }

  function goNext() {
    if (!user || !session) return;
    const next = Math.min(questions.length - 1, (session.currentIndex ?? 0) + 1);

    setSession({ ...session, currentIndex: next });
    setError("");

    applyAnswerState(session, questions[next]);

    updateDoc(doc(db, "users", user.uid, "sessions", sessionId), {
      currentIndex: next,
      updatedAt: serverTimestamp(),
    }).catch(console.error);
  }

  async function onConfirm() {
    const u = auth.currentUser;
    if (!u || !session || !currentQuestion) return;
    if (!selectedId) return;

    setConfirming(true);
    setError("");

    try {
      const sessRef = doc(db, "users", u.uid, "sessions", sessionId);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(sessRef);
        if (!snap.exists()) return;

        const sessNow = snap.data() as SessionDoc;
        const answersMap = (sessNow.answersMap || {}) as Record<string, AnswerEntry>;

        // ✅ se já respondeu essa questão, não incrementa de novo
        if (answersMap[currentQuestion.id]) return;

        const isCorrect = selectedId === currentQuestion.correctOptionId;

        answersMap[currentQuestion.id] = {
          selectedOptionId: selectedId,
          isCorrect,
          answeredAt: new Date(),
        };

        tx.update(sessRef, {
          answersMap,
          answeredCount: increment(1),
          correctCount: isCorrect ? increment(1) : increment(0),
          updatedAt: serverTimestamp(),
        });
      });

      // refresh sessão local
      const freshSnap = await getDoc(doc(db, "users", u.uid, "sessions", sessionId));
      const fresh = freshSnap.exists() ? (freshSnap.data() as SessionDoc) : session;

      setSession(fresh);
      setConfirmed(true);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Falha ao confirmar.");
    } finally {
      setConfirming(false);
    }
  }

  async function finalizeSimulado() {
    const u = auth.currentUser;
    if (!u || !session) return;

    setFinishing(true);
    setError("");

    try {
      const sessRef = doc(db, "users", u.uid, "sessions", sessionId);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(sessRef);
        if (!snap.exists()) return;

        const sessNow = snap.data() as SessionDoc;
        const totalNow = sessNow.totalQuestions ?? questions.length;
        const correctNow = sessNow.correctCount ?? 0;

        const scorePercent = totalNow > 0 ? Math.round((correctNow / totalNow) * 100) : 0;

        tx.update(sessRef, {
          status: "completed",
          scorePercent,
          updatedAt: serverTimestamp(),
        });
      });

      router.push(`/aluno/simulados/${sessionId}/resultado`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Falha ao finalizar.");
    } finally {
      setFinishing(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border bg-white shadow-sm p-6 text-slate-600">
        Carregando simulado…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border bg-white shadow-sm p-6">
        <div className="text-lg font-black text-slate-900">Simulado</div>
        <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
          {error}
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <Button variant="secondary" onClick={() => router.push("/aluno/simulados")}>
            Voltar
          </Button>
          <Button onClick={load}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="rounded-3xl border bg-white shadow-sm p-6 text-slate-600">
        Nenhuma questão encontrada.
      </div>
    );
  }

  const title = session?.title || "Simulado";
  const progress = total > 0 ? Math.round(((currentIndex + 1) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">Simulado</div>
            <div className="text-2xl font-black text-slate-900 truncate">{title}</div>
            <div className="text-sm text-slate-600 mt-1">
              Questão {Math.min(currentIndex + 1, total)} de {total}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200 px-3 py-1 text-xs font-bold">
                Respondidas: {answered}
              </span>
              <span className="rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 px-3 py-1 text-xs font-bold">
                Acertos: {correct}
              </span>
            </div>

            <div className="mt-3 h-3 w-full max-w-[520px] rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/aluno/simulados")}>
              Voltar
            </Button>
            <Button onClick={load}>Atualizar</Button>
          </div>
        </CardHeader>
      </Card>

      {/* Question */}
      <Card>
        <CardHeader>
          <div className="text-lg font-black text-slate-900">Pergunta</div>
        </CardHeader>

        <CardBody className="space-y-4">
          <div className="text-slate-900 leading-relaxed whitespace-pre-wrap">
            {currentQuestion.prompt?.trim() ? currentQuestion.prompt : "—"}
          </div>

          {currentQuestion.imageUrl ? (
            <button
              className="w-full rounded-2xl border bg-slate-50 p-3 hover:bg-slate-100 transition text-left"
              onClick={() => setImgModalUrl(currentQuestion.imageUrl || "")}
            >
              <div className="text-sm font-bold text-slate-900">Imagem da pergunta</div>
              <div className="text-xs text-slate-600 mt-1">Clique para ampliar</div>
            </button>
          ) : null}
        </CardBody>
      </Card>

      {/* Answers */}
      <Card>
        <CardHeader>
          <div className="text-2xl font-black text-slate-900">Respostas</div>
          <div className="text-sm text-slate-600 mt-1">
            Selecione uma alternativa e confirme para ver a correção.
          </div>
        </CardHeader>

        <CardBody className="space-y-4">
          <div className="space-y-3">
            {currentQuestion.options.map((opt) => {
              const isSelected = selectedId === opt.id;

              const isCorrect = confirmed && opt.id === currentQuestion.correctOptionId;
              const wrongSelected = confirmed && isSelected && opt.id !== currentQuestion.correctOptionId;

              return (
                <button
                  key={opt.id}
                  disabled={confirmed}
                  onClick={() => {
                    if (!confirmed) setSelectedId(opt.id);
                  }}
                  className={cn(
                    "w-full rounded-2xl border p-5 text-left transition",
                    isSelected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:bg-slate-50",
                    confirmed ? "cursor-not-allowed opacity-90" : ""
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "mt-1 h-6 w-6 rounded-full border flex items-center justify-center",
                        isSelected ? "border-slate-900" : "border-slate-300"
                      )}
                    >
                      <div className={cn("h-3 w-3 rounded-full", isSelected ? "bg-slate-900" : "bg-transparent")} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900">
                        {opt.id}) {opt.text || "—"}
                      </div>

                      {opt.imageUrl ? (
                        <div className="mt-3">
                          <div className="text-xs text-slate-500 font-semibold">Imagem da alternativa</div>
                          <div className="mt-2">
                            <button
                              type="button"
                              className="rounded-xl border bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setImgModalUrl(opt.imageUrl || "");
                              }}
                            >
                              Ver imagem
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {confirmed ? (
                        <div className="mt-3 text-sm">
                          {isCorrect ? <span className="text-emerald-700 font-semibold">✓ Correta</span> : null}
                          {wrongSelected ? <span className="text-red-700 font-semibold"> ✕ Você marcou esta</span> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Resultado + Comentário (STACK) */}
          {confirmed ? (
            <div className="pt-2 space-y-4">
              <div
                className={cn(
                  "rounded-2xl border px-5 py-4",
                  isCorrectSelected ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                )}
              >
                <div className="font-black text-slate-900">Resultado</div>
                <div className="mt-1 font-semibold">
                  {isCorrectSelected ? (
                    <span className="text-emerald-700">✓ Você acertou.</span>
                  ) : (
                    <span className="text-red-700">✕ Você errou.</span>
                  )}
                </div>
                <div className="mt-2 text-slate-800 text-sm">
                  Resposta correta: <span className="font-black">{currentQuestion.correctOptionId}</span>
                </div>
              </div>

              <div className="rounded-2xl border bg-white px-5 py-4">
                <div className="font-black text-slate-900">Comentário</div>
                <div className="mt-2 text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {currentQuestion.explanation?.trim() ? currentQuestion.explanation : "Sem comentário cadastrado."}
                </div>
              </div>
            </div>
          ) : null}

          {/* Footer actions */}
          <div className="pt-5 border-t flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <Button variant="secondary" onClick={goPrev} disabled={currentIndex === 0}>
              ← Anterior
            </Button>

            {!confirmed ? (
              <Button onClick={onConfirm} disabled={confirming || !selectedId} className="min-w-[220px]">
                {confirming ? "Confirmando…" : "Confirmar resposta"}
              </Button>
            ) : (
              <div className="text-sm font-semibold text-emerald-700">Resposta confirmada ✓</div>
            )}

            {!canFinalize ? (
              <Button variant="secondary" onClick={goNext} disabled={currentIndex >= questions.length - 1}>
                Próxima →
              </Button>
            ) : (
              <Button onClick={finalizeSimulado} disabled={finishing} className="min-w-[200px]">
                {finishing ? "Finalizando…" : "Finalizar"}
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Modal imagem */}
      {imgModalUrl ? (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setImgModalUrl("")}
        >
          <div className="max-w-4xl w-full rounded-2xl bg-white p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-2 py-1">
              <div className="text-sm font-bold text-slate-900">Imagem</div>
              <Button variant="secondary" size="sm" onClick={() => setImgModalUrl("")}>
                Fechar
              </Button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgModalUrl} alt="Imagem" className="w-full rounded-xl border" />
          </div>
        </div>
      ) : null}
    </div>
  );
}