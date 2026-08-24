// Serviço da "Questão do Dia".
// Seleciona uma questão por dia (prioriza tema fraco do aluno), com cache
// diário em users/{uid}/dailyQuestions/{YYYY-MM-DD} para não reprocessar.

import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { dayKey } from "@/lib/study-tracking";

export type RawQuestion = Record<string, unknown> & { id: string };

type StatsDoc = {
  byTheme?: Record<string, { total?: number; correct?: number }>;
};

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

function getExplanation(q: RawQuestion): string {
  return safeStr(q.explanation ?? q.comentario ?? q.comment ?? "");
}

function hasUsableExplanation(q: RawQuestion): boolean {
  const raw = getExplanation(q);
  if (!raw) return false;
  const text = raw.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!text) return false;
  if (text.includes("em breve")) return false;
  return true;
}

export type DailyQuestionDoc = {
  questionId: string;
  tema: string | null;
  answered: boolean;
  isCorrect: boolean | null;
  selectedOptionId?: string | null;
};

export type DailyQuestionResult = {
  dateKey: string;
  questionId: string;
  tema: string | null;
  answered: boolean;
  isCorrect: boolean | null;
  selectedOptionId: string | null;
  question: RawQuestion | null;
};

/** Leitura leve para a home: status da questão do dia (existe / respondida). */
export async function getDailyStatus(uid: string): Promise<{ dateKey: string; exists: boolean; answered: boolean } | null> {
  if (!uid) return null;
  const dateKey = dayKey();
  const snap = await getDoc(doc(db, "users", uid, "dailyQuestions", dateKey));
  if (!snap.exists()) return { dateKey, exists: false, answered: false };
  const d = snap.data() as DailyQuestionDoc;
  return { dateKey, exists: true, answered: !!d.answered };
}

async function fetchQuestion(qid: string): Promise<RawQuestion | null> {
  const snap = await getDoc(doc(db, "questionsBank", qid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Record<string, unknown>) };
}

/** Amostra mínima para um tema entrar no ranking de pontos fracos. */
export const MIN_THEME_SAMPLE = 3;

/** Quantos dos temas mais fracos entram no rodízio diário. */
export const FOCUS_POOL_SIZE = 3;

export type ThemeStats = Record<string, { total?: number; correct?: number }> | undefined;

/**
 * Ordena os temas do mais fraco para o mais forte, considerando apenas os que
 * têm amostra suficiente. Empate é desfeito pelo nome, para a ordem ser estável.
 */
export function rankWeakThemes(byTheme: ThemeStats, minSample = MIN_THEME_SAMPLE): string[] {
  if (!byTheme) return [];
  return Object.entries(byTheme)
    .map(([tema, agg]) => ({
      tema,
      total: Number(agg?.total ?? 0),
      correct: Number(agg?.correct ?? 0),
    }))
    .filter((r) => r.total >= minSample)
    .map((r) => ({ tema: r.tema, acc: r.correct / r.total }))
    .sort((a, b) => a.acc - b.acc || a.tema.localeCompare(b.tema, "pt-BR"))
    .map((r) => r.tema);
}

/** Dia do ano (1-366), usado para girar o rodízio uma vez por dia. */
export function dayOfYear(date = new Date()): number {
  const inicio = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - inicio.getTime()) / 86_400_000);
}

/**
 * Tema-foco do dia: alterna entre os N temas mais fracos conforme o dia.
 *
 * Antes o foco era sempre o pior tema do histórico inteiro, então travava no
 * mesmo assunto por semanas — o aluno via a mesma sugestão todo dia e parecia
 * que o app não estava atualizando. O rodízio mantém o direcionamento para as
 * fraquezas e ainda assim muda diariamente, mesmo sem o aluno responder nada.
 */
export function pickFocusTheme(byTheme: ThemeStats, date = new Date()): string | null {
  const ranked = rankWeakThemes(byTheme).slice(0, FOCUS_POOL_SIZE);
  if (ranked.length === 0) return null;
  return ranked[dayOfYear(date) % ranked.length];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Retorna (criando se necessário) a questão do dia.
 * O custo de varrer o banco só ocorre uma vez por dia (na criação).
 */
export async function getOrCreateDailyQuestion(uid: string): Promise<DailyQuestionResult> {
  const dateKey = dayKey();
  const dref = doc(db, "users", uid, "dailyQuestions", dateKey);

  const existing = await getDoc(dref);
  if (existing.exists()) {
    const d = existing.data() as DailyQuestionDoc;
    const question = await fetchQuestion(d.questionId);
    return {
      dateKey,
      questionId: d.questionId,
      tema: d.tema ?? null,
      answered: !!d.answered,
      isCorrect: d.answered ? !!d.isCorrect : null,
      selectedOptionId: d.selectedOptionId ?? null,
      question,
    };
  }

  // Seleção: stats (tema fraco) + banco + questão de ontem (evitar repetir)
  const yKey = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const [statsSnap, qbSnap, yesterdaySnap] = await Promise.all([
    getDoc(doc(db, "users", uid, "meta", "stats")),
    getDocs(collection(db, "questionsBank")),
    getDoc(doc(db, "users", uid, "dailyQuestions", yKey)),
  ]);

  const stats = statsSnap.exists() ? (statsSnap.data() as StatsDoc) : null;
  const weakTheme = pickFocusTheme(stats?.byTheme);
  const avoidId = yesterdaySnap.exists() ? safeStr((yesterdaySnap.data() as DailyQuestionDoc).questionId) : "";

  const pool: RawQuestion[] = qbSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as RawQuestion))
    .filter((q) => q.isActive !== false)
    .filter(hasUsableExplanation)
    .filter((q) => q.id !== avoidId);

  if (pool.length === 0) {
    return { dateKey, questionId: "", tema: null, answered: false, isCorrect: null, selectedOptionId: null, question: null };
  }

  // Prioriza tema fraco; se não houver, usa todo o pool
  let candidates = pool;
  if (weakTheme) {
    const themed = pool.filter((q) => extractThemes(q).some((t) => t.toLowerCase() === weakTheme.toLowerCase()));
    if (themed.length > 0) candidates = themed;
  }

  const chosen = shuffle(candidates)[0];
  const themes = extractThemes(chosen);
  const tema = (weakTheme && themes.includes(weakTheme)) ? weakTheme : (themes[0] ?? null);

  await setDoc(dref, {
    questionId: chosen.id,
    tema: tema ?? null,
    answered: false,
    isCorrect: null,
    createdAt: serverTimestamp(),
  });

  return { dateKey, questionId: chosen.id, tema: tema ?? null, answered: false, isCorrect: null, selectedOptionId: null, question: chosen };
}

/** Marca a questão do dia como respondida. */
export async function markDailyAnswered(
  uid: string,
  dateKey: string,
  isCorrect: boolean,
  selectedOptionId: string | null
): Promise<void> {
  await setDoc(
    doc(db, "users", uid, "dailyQuestions", dateKey),
    {
      answered: true,
      isCorrect,
      selectedOptionId: selectedOptionId || null,
      answeredAt: serverTimestamp(),
    },
    { merge: true }
  );
}
