"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type SessionDoc = {
  id: string;
  status?: "in_progress" | "completed";
  questionIds?: unknown;
  optionMap?: Record<string, string[]>;
  totalQuestions?: number;
  currentIndex?: number;
  answeredCount?: number;
  correctCount?: number;
  scorePercent?: number;
  answersMap?: Record<string, AnswerMapItem>;
  updatedAt?: unknown;
  title?: string;
  titleDisplay?: string;
};

type AnswerMapItem = {
  selectedOptionId?: string;
  isCorrect?: boolean;
  answeredAt?: unknown;
};

type QuestionOption = { id: string; text?: string; imageUrl?: string | null };

type QuestionDoc = {
  id: string;

  // enunciado
  prompt?: string;
  pergunta?: string;
  enunciado?: string;
  statement?: string;
  title?: string;
  text?: string;
  question?: string;

  // alternativas
  options?: QuestionOption[];

  // gabarito
  correctOptionId?: string;
  correctOption?: string;
  correct?: string;
  gabarito?: string;

  // comentário
  explanation?: unknown;
  comentario?: unknown;
  comment?: unknown;
  referencia?: unknown;
  referenca?: unknown;
  reference?: unknown;
  fonte?: unknown;
  bibliografia?: unknown;

  imageUrl?: string | null;
};

type LegacyQuestionDoc = {
  questionId?: unknown;
  questionsBankId?: unknown;
  bankId?: unknown;
  qid?: unknown;
  refId?: unknown;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function escapeHtml(raw: string) {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const ALLOWED_RICH_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "span",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "code",
  "pre",
  "a",
]);

function sanitizeRichText(raw: string) {
  const input = String(raw || "");
  if (!input) return "";

  if (typeof window === "undefined") {
    return escapeHtml(input).replaceAll("\n", "<br />");
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(input, "text/html");

  doc.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());

  const elements = Array.from(doc.body.querySelectorAll("*"));
  elements.forEach((el) => {
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_RICH_TAGS.has(tag)) {
      const fragment = doc.createDocumentFragment();
      while (el.firstChild) fragment.appendChild(el.firstChild);
      el.replaceWith(fragment);
      return;
    }

    const attrs = Array.from(el.attributes);
    attrs.forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;

      if (name.startsWith("on") || name === "style") {
        el.removeAttribute(attr.name);
        return;
      }

      if (tag === "a" && name === "href") {
        const href = value.trim().toLowerCase();
        const isSafeHref =
          href.startsWith("http://") ||
          href.startsWith("https://") ||
          href.startsWith("mailto:") ||
          href.startsWith("tel:");
        if (!isSafeHref) {
          el.removeAttribute("href");
        } else {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }
        return;
      }

      if (tag === "a" && (name === "target" || name === "rel")) return;
      if (name !== "href") el.removeAttribute(attr.name);
    });
  });

  return doc.body.innerHTML;
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function optionRank(id: unknown) {
  const key = safeStr(id).toUpperCase();
  if (key === "A") return 0;
  if (key === "B") return 1;
  if (key === "C") return 2;
  if (key === "D") return 3;
  if (key === "E") return 4;

  const numeric = Number(key);
  if (Number.isFinite(numeric)) return 100 + numeric;
  return 999;
}

function sortOptionsById(options: QuestionOption[] | undefined) {
  if (!Array.isArray(options) || options.length <= 1) return options ?? [];

  return [...options].sort((a, b) => {
    const rankDiff = optionRank(a.id) - optionRank(b.id);
    if (rankDiff !== 0) return rankDiff;
    return safeStr(a.id).localeCompare(safeStr(b.id), "pt-BR", { sensitivity: "base" });
  });
}

/**
 * ✅ session.questionIds pode vir:
 * - string[]
 * - [{id:"q_0001"}]
 * - qualquer coisa
 */
function normalizeIdList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object") {
          const item = x as { id?: unknown; questionId?: unknown; questionsBankId?: unknown };
          return item.id || item.questionId || item.questionsBankId || "";
        }
        return "";
      })
      .map((s) => safeStr(s))
      .filter(Boolean);
  }
  return [];
}

/**
 * ✅ Resolve IDs antigos:
 * 1) tenta direto em questionsBank/{id}
 * 2) tenta em questoes/{id} e extrai questionId -> q_0001
 * 3) tenta alguns campos alternativos
 */
async function resolveQuestionsBankId(maybeId: string): Promise<string> {
  const raw = safeStr(maybeId);
  if (!raw) throw new Error("ID de questão vazio.");

  // 1) tenta direto
  const bankRef = doc(db, "questionsBank", raw);
  const bankSnap = await getDoc(bankRef);
  if (bankSnap.exists()) return raw;

  // 2) tenta coleção "questoes"
  const legacyRef = doc(db, "questoes", raw);
  const legacySnap = await getDoc(legacyRef);
  if (legacySnap.exists()) {
    const data = legacySnap.data() as LegacyQuestionDoc;

    const qid =
      data?.questionId ||
      data?.questionsBankId ||
      data?.bankId ||
      data?.qid ||
      data?.refId ||
      "";

    const normalized = safeStr(qid);
    if (!normalized) {
      throw new Error(
        `Questão não encontrada (${raw}). Doc existe em "questoes", mas sem questionId.`
      );
    }

    // valida se existe no bank
    const bankRef2 = doc(db, "questionsBank", normalized);
    const bankSnap2 = await getDoc(bankRef2);
    if (bankSnap2.exists()) return normalized;

    throw new Error(`Questão não encontrada (${raw}). questionId "${normalized}" não existe no questionsBank.`);
  }

  throw new Error(`Questão não encontrada (${raw}).`);
}

async function getQuestionById(questionIdInput: string): Promise<QuestionDoc> {
  const resolvedId = await resolveQuestionsBankId(questionIdInput);
  const ref = doc(db, "questionsBank", resolvedId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`Questão não encontrada (${questionIdInput}).`);
  return { id: snap.id, ...(snap.data() as Omit<QuestionDoc, "id">) };
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

  // reportar erro
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportNotice, setReportNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isReviewMode = session?.status === "completed";
  const shouldShowFeedback = confirmed || isSubmitting || isReviewMode;

  const isFirst = currentIndex <= 0;

  const totalFromSession = useMemo(() => {
    const tq = Number(session?.totalQuestions ?? 0) || 0;
    const ql = normalizeIdList(session?.questionIds).length;
    return Math.max(tq, ql, questions.length);
  }, [session, questions.length]);

  const isLast = useMemo(() => {
    const total = totalFromSession || questions.length || 0;
    return total > 0 ? currentIndex >= total - 1 : false;
  }, [currentIndex, totalFromSession, questions.length]);

  const currentQuestion = useMemo(() => questions[currentIndex] ?? null, [questions, currentIndex]);
  const currentSavedAnswer = useMemo(() => {
    if (!session || !currentQuestion) return null;
    const saved = session.answersMap?.[currentQuestion.id];
    return saved && typeof saved === "object" ? saved : null;
  }, [session, currentQuestion]);

  const statement = useMemo(() => {
    return (
      currentQuestion?.pergunta ||
      currentQuestion?.enunciado ||
      currentQuestion?.statement ||
      currentQuestion?.prompt ||
      currentQuestion?.question ||
      currentQuestion?.text ||
      currentQuestion?.title ||
      "Pergunta não encontrada"
    );
  }, [currentQuestion]);
  const statementHtml = useMemo(() => sanitizeRichText(safeStr(statement)), [statement]);

  const correctId = useMemo(() => {
    return (
      currentQuestion?.correctOptionId ||
      currentQuestion?.correctOption ||
      currentQuestion?.correct ||
      currentQuestion?.gabarito ||
      null
    );
  }, [currentQuestion]);

  const explanationText = useMemo(() => {
    const raw =
      currentQuestion?.explanation ??
      currentQuestion?.comentario ??
      currentQuestion?.comment ??
      "";

    const s = safeStr(raw);

    // se vier "Resposta: X Comentário: Y", mantém tudo
    return s;
  }, [currentQuestion]);
  const explanationHtml = useMemo(() => sanitizeRichText(explanationText), [explanationText]);

  const referenceText = useMemo(() => {
    const raw =
      currentQuestion?.referencia ??
      currentQuestion?.referenca ??
      currentQuestion?.reference ??
      currentQuestion?.fonte ??
      currentQuestion?.bibliografia ??
      "";
    return safeStr(raw);
  }, [currentQuestion]);
  const referenceHtml = useMemo(() => sanitizeRichText(referenceText), [referenceText]);

  const load = useCallback(async () => {
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

      const sess: SessionDoc = { id: snap.id, ...(snap.data() as Omit<SessionDoc, "id">) };

      const questionIds = normalizeIdList(sess.questionIds);
      if (!questionIds.length) {
        throw new Error("Nenhuma questão foi carregada. (questionIds vazio na session)");
      }

      // ✅ carrega robusto
      const loaded = await Promise.all(questionIds.map((qid) => getQuestionById(qid)));

      // mantém ordem
      const ordered = questionIds
        .map((qid) => {
          const question = loaded.find((q) => q.id === qid) || loaded[0] || null;
          if (!question) return null;

          return {
            ...question,
            // Exibe sempre em ordem A, B, C, D, E (sem embaralhar na tela).
            options: sortOptionsById(question.options),
          };
        })
        .filter(Boolean) as QuestionDoc[];

      setSession(sess);
      setQuestions(ordered);

      const idx = Number(sess.currentIndex ?? 0) || 0;
      const nextIndex =
        sess.status === "completed"
          ? 0
          : Math.min(Math.max(0, idx), Math.max(0, ordered.length - 1));

      setCurrentIndex(nextIndex);

      if (sess.status === "completed" && idx !== 0) {
        await updateDoc(sessionRef, {
          currentIndex: 0,
          updatedAt: serverTimestamp(),
        });
      }

    } catch (error: unknown) {
      console.error(error);
      setErr(getErrorMessage(error, "Falha ao carregar simulado."));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setReportOpen(false);
    setReportText("");
    setReportNotice(null);

    if (!currentQuestion) {
      setSelectedOptionId(null);
      setConfirmed(false);
      setIsCorrect(null);
      return;
    }

    if (currentSavedAnswer) {
      const savedOptionId = safeStr(currentSavedAnswer.selectedOptionId);
      setSelectedOptionId(savedOptionId || null);
      setConfirmed(true);
      setIsCorrect(Boolean(currentSavedAnswer.isCorrect));
      return;
    }

    setSelectedOptionId(null);
    setConfirmed(false);
    setIsCorrect(null);
  }, [currentQuestion, currentSavedAnswer]);

  async function persistIndex(nextIndex: number) {
    const u = auth.currentUser;
    if (!u) return;

    try {
      await updateDoc(doc(db, "users", u.uid, "sessions", sessionId), {
        currentIndex: nextIndex,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Falha ao persistir índice da sessão:", error);
    }
  }

  async function onConfirm() {
    if (!session || !currentQuestion || !selectedOptionId || isReviewMode) return;

    const u = auth.currentUser;
    if (!u) return;

    setIsSubmitting(true);

    try {
      const chosen = safeStr(selectedOptionId);
      const correct = safeStr(correctId);

      const sessionRef = doc(db, "users", u.uid, "sessions", sessionId);
      const result = await runTransaction(db, async (tx) => {
        const snap = await tx.get(sessionRef);
        if (!snap.exists()) throw new Error("Sessão não encontrada.");

        const persisted = snap.data() as SessionDoc;
        const existingAnswer = persisted.answersMap?.[currentQuestion.id];
        if (existingAnswer && typeof existingAnswer === "object") {
          return {
            alreadyAnswered: true,
            selectedOptionId: safeStr(existingAnswer.selectedOptionId),
            isCorrect: Boolean(existingAnswer.isCorrect),
            answeredCount: Number(persisted.answeredCount ?? 0),
            correctCount: Number(persisted.correctCount ?? 0),
            scorePercent: Number(persisted.scorePercent ?? 0),
          };
        }

        const ok = !!(correct && chosen && correct === chosen);
        const nextAnsweredCount = Number(persisted.answeredCount ?? 0) + 1;
        const nextCorrectCount = Number(persisted.correctCount ?? 0) + (ok ? 1 : 0);
        const total =
          Number(persisted.totalQuestions ?? normalizeIdList(persisted.questionIds).length ?? 0) ||
          questions.length ||
          0;
        const scorePercent = total > 0 ? Math.round((nextCorrectCount / total) * 100) : 0;

        tx.update(sessionRef, {
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

        return {
          alreadyAnswered: false,
          selectedOptionId: chosen,
          isCorrect: ok,
          answeredCount: nextAnsweredCount,
          correctCount: nextCorrectCount,
          scorePercent,
        };
      });

      setSession((prev) =>
        prev
          ? {
              ...prev,
              answeredCount: result.answeredCount,
              correctCount: result.correctCount,
              scorePercent: result.scorePercent,
              answersMap: {
                ...(prev.answersMap ?? {}),
                [currentQuestion.id]: {
                  selectedOptionId: result.selectedOptionId,
                  isCorrect: result.isCorrect,
                  answeredAt: new Date(),
                },
              },
            }
          : prev
      );

      setConfirmed(true);
      setSelectedOptionId(result.selectedOptionId || null);
      setIsCorrect(result.isCorrect);
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
    setReportOpen(false);
    setReportText("");
    setReportNotice(null);
  }

  function onNext() {
    if (isLast) return;
    const next = currentIndex + 1;
    setCurrentIndex(next);
    persistIndex(next);

    setSelectedOptionId(null);
    setConfirmed(false);
    setIsCorrect(null);
    setReportOpen(false);
    setReportText("");
    setReportNotice(null);
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

  async function onSendReport() {
    const u = auth.currentUser;
    if (!u || !currentQuestion) return;

    const msg = safeStr(reportText);
    if (!msg) return;

    setReportSending(true);
    setReportNotice(null);
    try {
      await addDoc(collection(db, "erros_reportados"), {
        createdAt: serverTimestamp(),
        status: "open",
        userId: u.uid,
        userEmail: u.email ?? null,
        sessionId,
        questionId: currentQuestion.id, // ✅ id do questionsBank
        selectedOptionId: selectedOptionId ?? null,
        correctOptionId: correctId ?? null,
        message: msg,
        origin: "web-aluno",
      });

      setReportOpen(false);
      setReportText("");
      setReportNotice({
        type: "success",
        text: "Erro reportado com sucesso. Obrigado pelo feedback.",
      });
    } catch (e) {
      console.error(e);
      setReportNotice({
        type: "error",
        text: "Não foi possível reportar agora. Tente novamente em instantes.",
      });
    } finally {
      setReportSending(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100">Simulado</div>
        </CardHeader>
        <CardBody className="text-slate-600 dark:text-slate-300">Carregando…</CardBody>
      </Card>
    );
  }

  if (err) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100">Simulado</div>
        </CardHeader>
        <CardBody>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
            {err}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
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

  const canFinalize = !isReviewMode && isLast;
  const finalizeDisabled = !confirmed || isSubmitting || isFinishing;
  const hasSavedAnswer = !!currentSavedAnswer && !!safeStr(currentSavedAnswer.selectedOptionId);
  const showResultPanel = confirmed || isReviewMode;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2">
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Pergunta</div>
          <div
            className="text-[15px] leading-7 text-slate-900 dark:text-slate-100 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: statementHtml }}
          />
        </CardHeader>

        <CardBody className="space-y-4">
          {currentQuestion.options?.map((opt) => {
            const isSelected = selectedOptionId === opt.id;

            const showResult = shouldShowFeedback && !!correctId;
            const isCorrectOpt = showResult && opt.id === correctId;
            const isWrongOpt = showResult && isSelected && opt.id !== correctId;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => !confirmed && !isReviewMode && setSelectedOptionId(opt.id)}
                className={cn(
                  "w-full text-left rounded-2xl border px-4 py-4 transition outline-none",
                  "focus:ring-2 focus:ring-slate-900/10",
                  !confirmed && !isReviewMode && "hover:shadow-[0_10px_30px_rgba(15,23,42,0.08)]",
                  isSelected
                    ? "border-slate-900/50 bg-slate-900/5 dark:border-slate-400 dark:bg-slate-800"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
                  isCorrectOpt && "border-emerald-300 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30",
                  isWrongOpt && "border-rose-300 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 border text-sm font-black",
                      isCorrectOpt
                        ? "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : isWrongOpt
                        ? "border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300"
                        : isSelected
                        ? "border-slate-900/40 bg-slate-900 text-white dark:border-slate-400 dark:bg-slate-100 dark:text-slate-900"
                        : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    )}
                  >
                    {opt.id}
                  </div>

                  <div className="min-w-0">
                    <div
                      className="text-[14px] leading-6 text-slate-900 dark:text-slate-100 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline"
                      dangerouslySetInnerHTML={{ __html: sanitizeRichText(safeStr(opt.text)) }}
                    />
                  </div>
                </div>
              </button>
            );
          })}

          {!showResultPanel ? (
            <div className="pt-2">
              <Button
                className="w-full"
                disabled={!selectedOptionId || isSubmitting}
                onClick={onConfirm}
              >
                {isSubmitting ? "Confirmando…" : "Confirmar resposta"}
              </Button>
            </div>
          ) : (
            <div className="pt-2 space-y-4">
              <div
                className={cn(
                  "rounded-2xl border px-5 py-4",
                  hasSavedAnswer
                    ? isCorrect
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                      : "border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/30"
                    : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
                )}
              >
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Resultado</div>
                {hasSavedAnswer ? (
                  <div
                    className={cn(
                      "mt-1 text-sm font-semibold",
                      isCorrect ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"
                    )}
                  >
                    {isCorrect ? "✅ Você acertou!" : "❌ Você errou."}
                  </div>
                ) : (
                  <div className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    Questão sem resposta registrada.
                  </div>
                )}
              </div>

              {/* ✅ comentário */}
              {explanationText ? (
                <div className="rounded-2xl border bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Comentário</div>
                  <div
                    className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_strong]:font-bold [&_u]:underline"
                    dangerouslySetInnerHTML={{ __html: explanationHtml }}
                  />
                </div>
              ) : null}

              {referenceText ? (
                <div className="rounded-2xl border bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">Referência</div>
                  <div
                    className="mt-1 text-sm leading-6 text-slate-700 break-words dark:text-slate-300 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline [&_strong]:font-bold [&_u]:underline"
                    dangerouslySetInnerHTML={{ __html: referenceHtml }}
                  />
                </div>
              ) : null}

            </div>
          )}

          {/* Footer */}
          <div className="grid grid-cols-2 gap-3 pt-4">
            <Button className="w-full" variant="secondary" onClick={onPrev} disabled={isFirst}>
              ← Anterior
            </Button>

            {canFinalize ? (
              <Button className="w-full" onClick={onFinish} disabled={finalizeDisabled}>
                {isFinishing ? "Finalizando…" : "Finalizar →"}
              </Button>
            ) : isReviewMode && isLast ? (
              <Button className="w-full" onClick={() => router.push(`/aluno/simulados/${sessionId}/resultado`)}>
                Voltar ao resultado
              </Button>
            ) : (
              <Button
                className="w-full"
                variant="secondary"
                onClick={onNext}
                disabled={isReviewMode ? isLast : !confirmed || isLast}
              >
                Próxima →
              </Button>
            )}
          </div>

          {showResultPanel ? (
            <div className="pt-3 space-y-3">
              <div className="flex justify-start">
                <Button
                  size="sm"
                  className="w-auto px-4"
                  variant="secondary"
                  onClick={() => {
                    setReportNotice(null);
                    setReportOpen((v) => !v);
                  }}
                >
                  Reportar erro
                </Button>
              </div>

              {reportNotice ? (
                <div
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-sm font-semibold",
                    reportNotice.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300"
                      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
                  )}
                >
                  {reportNotice.text}
                </div>
              ) : null}

              {reportOpen ? (
                <div className="rounded-2xl border bg-slate-50 p-4 space-y-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Descreva o problema:
                  </div>
                  <textarea
                    className="ui-textarea"
                    placeholder="Ex: enunciado incompleto, alternativa errada, gabarito errado, etc."
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={onSendReport}
                      disabled={!safeStr(reportText) || reportSending}
                    >
                      {reportSending ? "Enviando…" : "Enviar"}
                    </Button>
                    <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setReportOpen(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {showResultPanel ? (
            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {isReviewMode
                ? `Revisão ${Math.min(currentIndex + 1, Math.max(totalFromSession, 1))}/${Math.max(totalFromSession, 1)}`
                : "Resposta confirmada ✓"}
            </div>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
