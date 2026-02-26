import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * getAttempt(attemptId) -> usa auth.currentUser.uid
 * getAttempt(uid, attemptId) -> usa uid explícito
 */
export async function getAttempt(uidOrAttemptId: string, maybeAttemptId?: string) {
  const uid = maybeAttemptId ? auth.currentUser?.uid : auth.currentUser?.uid;
  const attemptId = maybeAttemptId ? maybeAttemptId : uidOrAttemptId;

  if (!uid) throw new Error("Você precisa estar logado.");

  const ref = doc(db, "users", uid, "attempts", attemptId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Tentativa não encontrada.");

  return { id: snap.id, ...snap.data() };
}