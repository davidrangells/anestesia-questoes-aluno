import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  increment,
  setDoc,
} from "firebase/firestore";

/**
 * getAttempt(attemptId) -> usa auth.currentUser.uid
 * getAttempt(uid, attemptId) -> usa uid explícito
 */
export async function getAttempt(uidOrAttemptId: string, maybeAttemptId?: string) {
  const uid = auth.currentUser?.uid;
  const attemptId = maybeAttemptId ? maybeAttemptId : uidOrAttemptId;

  if (!uid) throw new Error("Você precisa estar logado.");

  const ref = doc(db, "users", uid, "attempts", attemptId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Tentativa não encontrada.");

  return { id: snap.id, ...snap.data() };
}

/**
 * Busca questão pelo ID (questionsBank)
 */
export async function getQuestionById(questionId: string) {
  const ref = doc(db, "questionsBank", questionId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Questão não encontrada.");

  return { id: snap.id, ...snap.data() };
}

/**
 * Confirma resposta
 */
export async function confirmAnswer(
  attemptId: string,
  questionId: string,
  selectedOptionId: string,
  isCorrect: boolean
) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Usuário não autenticado.");

  const attemptRef = doc(db, "users", uid, "attempts", attemptId);

  await updateDoc(attemptRef, {
    answeredCount: increment(1),
    correctCount: isCorrect ? increment(1) : increment(0),
    updatedAt: serverTimestamp(),
  });

  const answerRef = doc(
    db,
    "users",
    uid,
    "attempts",
    attemptId,
    "answers",
    questionId
  );

  await setDoc(
    answerRef,
    {
      selectedOptionId,
      isCorrect,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Atualiza índice atual
 */
export async function setCurrentIndex(
  attemptId: string,
  index: number
) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Usuário não autenticado.");

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
  attemptId: string,
  total: number,
  correct: number
) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Usuário não autenticado.");

  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;

  const ref = doc(db, "users", uid, "attempts", attemptId);

  await updateDoc(ref, {
    status: "completed",
    scorePercent,
    finishedAt: serverTimestamp(),
  });
}