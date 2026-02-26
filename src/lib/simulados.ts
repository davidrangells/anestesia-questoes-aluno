// src/lib/simulados.ts
import { auth, db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";

export type AttemptDoc = {
  id: string;

  sessionId?: string;
  title?: string;

  status?: "in_progress" | "completed";

  questionIds: string[];
  currentIndex: number;

  totalQuestions?: number;
  answeredCount?: number;
  correctCount?: number;
  scorePercent?: number;

  // opcional (se você estiver salvando no attempt também)
  answersMap?: Record<string, string>;
};

export type QuestionDoc = {
  id: string;

  title?: string;
  statement?: string;
  enunciado?: string;
  pergunta?: string;

  imageUrl?: string | null;

  options?: Array<{ id: string; text?: string; imageUrl?: string | null }>;
  correctOptionId?: string;
  correct?: string;
  gabarito?: string;

  explanation?: string | null;
  comentario?: string | null;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * getAttempt(attemptId) -> usa auth.currentUser.uid
 * getAttempt(uid, attemptId) -> usa uid explícito
 */
export async function getAttempt(uidOrAttemptId: string, maybeAttemptId?: string): Promise<AttemptDoc> {
  const uid = auth.currentUser?.uid;
  const attemptId = maybeAttemptId ? maybeAttemptId : uidOrAttemptId;

  if (!uid) throw new Error("Você precisa estar logado.");

  const ref = doc(db, "users", uid, "attempts", attemptId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Tentativa não encontrada.");

  const d = snap.data() as any;

  return {
    id: snap.id,
    ...d,
    // ✅ garante tipos/valores mínimos
    questionIds: Array.isArray(d?.questionIds) ? d.questionIds : [],
    currentIndex: Number.isFinite(d?.currentIndex) ? d.currentIndex : 0,
  };
}

export async function getQuestionById(questionId: string): Promise<QuestionDoc> {
  if (!questionId) throw new Error("questionId inválido.");

  // ⚠️ ajuste aqui caso seu banco esteja em "questionsBank"
  // (no seu quiz-client você usa "questoes", então mantive igual)
  const ref = doc(db, "questoes", questionId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Questão não encontrada.");

  return { id: snap.id, ...(snap.data() as any) };
}

/**
 * Salva resposta em:
 * users/{uid}/attempts/{attemptId}/answers/{questionId}
 * e atualiza counters no attempt.
 */
export async function confirmAnswer(params: {
  attemptId: string;
  question: { id: string; correctOptionId?: string };
  selectedOptionId: string;
}) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Você precisa estar logado.");

  const { attemptId, question, selectedOptionId } = params;
  if (!attemptId) throw new Error("attemptId inválido.");

  const attemptRef = doc(db, "users", uid, "attempts", attemptId);
  const answerRef = doc(db, "users", uid, "attempts", attemptId, "answers", question.id);

  const correctId = safeStr(question.correctOptionId);
  const chosenId = safeStr(selectedOptionId);
  const isCorrect = correctId && chosenId ? chosenId === correctId : false;

  // cria/atualiza answer
  await setDoc(
    answerRef,
    {
      questionId: question.id,
      selectedOptionId: chosenId,
      correctOptionId: correctId,
      isCorrect,
      answeredAt: serverTimestamp(),
    },
    { merge: true }
  );

  // incrementa contadores (simples)
  await updateDoc(attemptRef, {
    answeredCount: increment(1),
    correctCount: isCorrect ? increment(1) : increment(0),
    updatedAt: serverTimestamp(),
  });

  return { isCorrect };
}

export async function setCurrentIndex(attemptId: string, currentIndex: number) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Você precisa estar logado.");
  if (!attemptId) throw new Error("attemptId inválido.");

  const attemptRef = doc(db, "users", uid, "attempts", attemptId);

  await updateDoc(attemptRef, {
    currentIndex,
    updatedAt: serverTimestamp(),
  });
}

export async function finishAttempt(attemptId: string) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Você precisa estar logado.");
  if (!attemptId) throw new Error("attemptId inválido.");

  const attemptRef = doc(db, "users", uid, "attempts", attemptId);
  const snap = await getDoc(attemptRef);
  if (!snap.exists()) throw new Error("Tentativa não encontrada.");

  const a = snap.data() as any;

  const total = Number(a?.totalQuestions ?? a?.questionIds?.length ?? 0) || 0;
  const correct = Number(a?.correctCount ?? 0) || 0;
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

  await updateDoc(attemptRef, {
    status: "completed",
    scorePercent,
    updatedAt: serverTimestamp(),
  });

  return { scorePercent };
}