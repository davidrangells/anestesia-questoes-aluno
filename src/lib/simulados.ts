import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";

/**
 * Busca tentativa (attempt)
 */
export async function getAttempt(uid: string, attemptId: string) {
  const ref = doc(db, "users", uid, "attempts", attemptId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Tentativa não encontrada.");
  }

  return { id: snap.id, ...snap.data() };
}

/**
 * Busca questão pelo ID (questionsBank)
 */
export async function getQuestionById(questionId: string) {
  const ref = doc(db, "questionsBank", questionId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Questão não encontrada.");
  }

  return { id: snap.id, ...snap.data() };
}

/**
 * Confirma resposta
 */
export async function confirmAnswer(
  uid: string,
  attemptId: string,
  questionId: string,
  selectedOptionId: string,
  isCorrect: boolean
) {
  const ref = doc(db, "users", uid, "attempts", attemptId);

  await updateDoc(ref, {
    answeredCount: increment(1),
    correctCount: isCorrect ? increment(1) : increment(0),
    updatedAt: serverTimestamp(),
  });

  // salva resposta individual (opcional)
  const answerRef = doc(
    db,
    "users",
    uid,
    "attempts",
    attemptId,
    "answers",
    questionId
  );

  await updateDoc(answerRef, {
    selectedOptionId,
    isCorrect,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Atualiza índice atual
 */
export async function setCurrentIndex(
  uid: string,
  attemptId: string,
  index: number
) {
  const ref = doc(db, "users", uid, "attempts", attemptId);

  await updateDoc(ref, {
    currentIndex: index,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Finaliza tentativa
 */
export async function finishAttempt(
  uid: string,
  attemptId: string,
  total: number,
  correct: number
) {
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

  const ref = doc(db, "users", uid, "attempts", attemptId);

  await updateDoc(ref, {
    status: "completed",
    scorePercent,
    finishedAt: serverTimestamp(),
  });
}