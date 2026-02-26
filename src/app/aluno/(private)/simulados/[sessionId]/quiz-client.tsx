"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  runTransaction,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import AlunoShell from "@/components/aluno/AlunoShell";

type Question = {
  id: string;
  title?: string;
  statement?: string;
  imageUrl?: string | null;
  options: { id: string; text?: string; imageUrl?: string | null }[];
  correctOptionId?: string;
  explanation?: string | null;
};

type AnswerEntry = {
  selectedOptionId: string;
  isCorrect: boolean;
  answeredAt?: any;
};

function computeCounts(answersMap: Record<string, AnswerEntry> | undefined) {
  const entries = answersMap ? Object.values(answersMap) : [];
  const answeredCount = entries.length;
  const correctCount = entries.filter((a) => a?.isCorrect).length;
  return { answeredCount, correctCount };
}

async function getQuestionDocById(qid: string) {
  // tenta questionsBank
  const ref1 = doc(db, "questionsBank", qid);
  const snap1 = await getDoc(ref1);
  if (snap1.exists()) return { id: snap1.id, ...(snap1.data() as any) };

  // fallback questoes
  const ref2 = doc(db, "questoes", qid);
  const snap2 = await getDoc(ref2);
  if (snap2.exists()) return { id: snap2.id, ...(snap2.data() as any) };

  return null;
}

export default function QuizClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  const [session, setSession] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const user = auth.currentUser;
      if (!user) throw new Error("Usuário não autenticado.");

      const sessRef = doc(db, "users", user.uid, "sessions", sessionId);
      const sessSnap = await getDoc(sessRef);

      if (!sessSnap.exists()) {
        throw new Error("Sessão não encontrada.");
      }

      const raw = sessSnap.data();

      const answersMap =
        raw.answersMap && typeof raw.answersMap === "object"
          ? raw.answersMap
          : {};

      const { answeredCount, correctCount } = computeCounts(answersMap);

      const normalized = {
        ...raw,
        answersMap,
        answeredCount,
        correctCount,
        totalQuestions:
          raw.totalQuestions ??
          (Array.isArray(raw.questionIds) ? raw.questionIds.length : 0),
        currentIndex:
          Number.isFinite(raw.currentIndex) ? raw.currentIndex : 0,
      };

      setSession(normalized);

      const questionIds = Array.isArray(normalized.questionIds)
        ? normalized.questionIds
        : [];

      if (!questionIds.length) {
        throw new Error("Nenhuma questão vinculada.");
      }

      const qsRaw = await Promise.all(
        questionIds.map((qid: string) => getQuestionDocById(qid))
      );

      const qs = qsRaw
        .filter(Boolean)
        .map((q: any) => ({
          id: q.id,
          title: q.title || "",
          statement:
            q.statement || q.prompt || q.enunciado || q.pergunta || "",
          imageUrl: q.imageUrl || null,
          options: Array.isArray(q.options) ? q.options : [],
          correctOptionId: q.correctOptionId || "",
          explanation: q.explanation || null,
        }));

      setQuestions(qs);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }

  const currentQuestion = useMemo(() => {
    if (!session || !questions.length) return null;
    return questions[session.currentIndex] ?? null;
  }, [session, questions]);

  async function onConfirm() {
    if (!auth.currentUser || !session || !currentQuestion) return;
    if (!selectedId) return;

    setConfirming(true);
    setError("");

    try {
      const sessRef = doc(
        db,
        "users",
        auth.currentUser.uid,
        "sessions",
        sessionId
      );

      const qid = currentQuestion.id;
      const correctId = currentQuestion.correctOptionId;
      const isCorrect = selectedId === correctId;

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(sessRef);
        if (!snap.exists()) throw new Error("Sessão não encontrada.");

        const data = snap.data();
        const prevMap =
          data.answersMap && typeof data.answersMap === "object"
            ? data.answersMap
            : {};

        const nextMap = {
          ...prevMap,
          [qid]: {
            selectedOptionId: selectedId,
            isCorrect,
            answeredAt: serverTimestamp(),
          },
        };

        const { answeredCount, correctCount } =
          computeCounts(nextMap);

        tx.update(sessRef, {
          answersMap: nextMap,
          answeredCount,
          correctCount,
          updatedAt: serverTimestamp(),
        });
      });

      setSession((prev: any) => {
        const nextMap = {
          ...(prev.answersMap || {}),
          [currentQuestion.id]: {
            selectedOptionId: selectedId,
            isCorrect,
            answeredAt: new Date(),
          },
        };

        const { answeredCount, correctCount } =
          computeCounts(nextMap);

        return { ...prev, answersMap: nextMap, answeredCount, correctCount };
      });

      setConfirmed(true);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Erro ao confirmar.");
    } finally {
      setConfirming(false);
    }
  }

  async function goNext() {
    if (!session) return;

    const next = session.currentIndex + 1;

    if (next >= session.totalQuestions) {
      await finalize();
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    const sessRef = doc(db, "users", user.uid, "sessions", sessionId);

    await updateDoc(sessRef, {
      currentIndex: next,
      updatedAt: serverTimestamp(),
    });

    setSession((prev: any) => ({
      ...prev,
      currentIndex: next,
    }));

    setSelectedId(null);
    setConfirmed(false);
  }

  async function finalize() {
    if (!session || !auth.currentUser) return;

    const answersMap = session.answersMap || {};
    const { correctCount } = computeCounts(answersMap);

    const total = session.totalQuestions ?? questions.length;
    const scorePercent =
      total > 0 ? Math.round((correctCount / total) * 100) : 0;

    const sessRef = doc(
      db,
      "users",
      auth.currentUser.uid,
      "sessions",
      sessionId
    );

    await updateDoc(sessRef, {
      status: "completed",
      scorePercent,
      updatedAt: serverTimestamp(),
    });

    router.push(`/aluno/simulados/${sessionId}/resultado`);
  }

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>{error}</div>;
  if (!currentQuestion) return <div>Sem questão.</div>;

  return (
    <AlunoShell title="Simulado">
      <div>
        <h2>{currentQuestion.statement}</h2>

        {currentQuestion.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => !confirmed && setSelectedId(opt.id)}
          >
            {opt.id}) {opt.text}
          </button>
        ))}

        {!confirmed ? (
          <button disabled={!selectedId || confirming} onClick={onConfirm}>
            Confirmar
          </button>
        ) : (
          <button onClick={goNext}>Próxima</button>
        )}
      </div>
    </AlunoShell>
  );
}