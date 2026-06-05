// Camada de serviço de acompanhamento de estudo.
// A cada resposta de questão, atualiza:
//  1) users/{uid}/meta/stats  → estatísticas agregadas (baratas de ler depois)
//  2) users/{uid}/errorNotebook/{questionId} → Caderno de Erros
//
// É chamado de forma não-bloqueante (void) após a resposta ser persistida,
// para não atrasar a UI nem comprometer a escrita principal da sessão.

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, increment } from "firebase/firestore";

type RawQuestion = Record<string, unknown> & { id: string };

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function extractThemes(q: RawQuestion): string[] {
  const arr: string[] = [];
  if (Array.isArray(q.themes)) arr.push(...q.themes.map(safeStr).filter(Boolean));
  if (Array.isArray(q.temas)) arr.push(...q.temas.map(safeStr).filter(Boolean));
  [q.tema, q.theme, q.topic].map(safeStr).filter(Boolean).forEach((t) => arr.push(t));
  return [...new Set(arr)];
}

function getStatement(q: RawQuestion): string {
  return safeStr(
    q.enunciado ?? q.statement ?? q.prompt ?? q.pergunta ?? q.title ?? q.text ?? q.question
  );
}

function plainSnippet(raw: string, max = 220): string {
  const text = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
}

export type RecordAnswerInput = {
  uid: string;
  question: RawQuestion;
  isCorrect: boolean;
  selectedOptionId: string | null;
  correctOptionId: string | null;
};

/**
 * Registra uma resposta nas estatísticas agregadas e no caderno de erros.
 * Best-effort: falhas são logadas mas não propagadas.
 */
export async function recordAnswer(input: RecordAnswerInput): Promise<void> {
  const { uid, question, isCorrect, selectedOptionId, correctOptionId } = input;
  const qid = safeStr(question.id);
  if (!uid || !qid) return;

  const temas = extractThemes(question);

  // 1) Estatísticas agregadas (incrementos, sem leitura prévia)
  try {
    const statsRef = doc(db, "users", uid, "meta", "stats");
    const byTheme: Record<string, { total: ReturnType<typeof increment>; correct: ReturnType<typeof increment> }> = {};
    for (const t of temas) {
      byTheme[t] = { total: increment(1), correct: increment(isCorrect ? 1 : 0) };
    }
    await setDoc(
      statsRef,
      {
        totalAnswered: increment(1),
        totalCorrect: increment(isCorrect ? 1 : 0),
        ...(temas.length ? { byTheme } : {}),
        lastAnswerAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error("[study-tracking] falha ao atualizar stats:", e);
  }

  // 2) Caderno de erros
  try {
    const errRef = doc(db, "users", uid, "errorNotebook", qid);
    const snap = await getDoc(errRef);
    const exists = snap.exists();

    if (!isCorrect) {
      // Errou → entra (ou volta) para pendente
      if (!exists) {
        await setDoc(errRef, {
          questionId: qid,
          temas,
          enunciadoSnippet: plainSnippet(getStatement(question)),
          correctOptionId: correctOptionId || null,
          lastSelectedOptionId: selectedOptionId || null,
          timesWrong: 1,
          timesCorrect: 0,
          status: "pending",
          createdAt: serverTimestamp(),
          lastWrongAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(
          errRef,
          {
            temas,
            enunciadoSnippet: plainSnippet(getStatement(question)),
            correctOptionId: correctOptionId || null,
            lastSelectedOptionId: selectedOptionId || null,
            timesWrong: increment(1),
            status: "pending",
            lastWrongAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
    } else if (exists) {
      // Acertou uma questão que estava no caderno → resolvida
      await setDoc(
        errRef,
        {
          timesCorrect: increment(1),
          status: "resolved",
          resolvedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (e) {
    console.error("[study-tracking] falha ao atualizar caderno de erros:", e);
  }
}
