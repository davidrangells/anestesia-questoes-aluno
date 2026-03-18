"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from "firebase/firestore";
import { useRouter } from "next/navigation";

import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SessionDoc = {
  id: string;
  status?: "in_progress" | "completed";
  totalQuestions?: number;
  answeredCount?: number;
  correctCount?: number;
  scorePercent?: number;
  updatedAt?: unknown;
  createdAt?: unknown;
  title?: string;
  questionIds?: unknown;
  answersMap?: Record<string, { isCorrect?: boolean }>;
  filters?: {
    temas?: string[];
  };
  control?: boolean;
  kind?: string;
};

type TimestampLike = {
  toMillis?: () => number;
};

type QuestionThemeDoc = {
  themes?: unknown;
  tema?: unknown;
  theme?: unknown;
  topic?: unknown;
};

type ThemePerformance = {
  theme: string;
  total: number;
  correct: number;
  wrong: number;
  accuracy: number;
};

type DashboardCache = {
  ts: number;
  sessions: SessionDoc[];
  themePerformance: ThemePerformance[];
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeQuestionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const raw = item as { id?: unknown; questionId?: unknown };
        if (typeof raw.id === "string") return raw.id.trim();
        if (typeof raw.questionId === "string") return raw.questionId.trim();
      }
      return "";
    })
    .filter(Boolean);
}

function extractQuestionThemes(question: QuestionThemeDoc): string[] {
  const fromList = toStringList(question.themes);
  if (fromList.length) return fromList;

  const singleCandidates = [question.tema, question.theme, question.topic];
  for (const candidate of singleCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return [candidate.trim()];
    }
  }

  return [];
}

function formatPct(v: number) {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v)}%`;
}

function safeNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function tsToMs(v: unknown): number {
  if (!v) return 0;
  if (typeof v === "object" && v !== null && "toMillis" in v && typeof (v as TimestampLike).toMillis === "function") {
    return (v as TimestampLike).toMillis!();
  }
  if (typeof v === "string" || typeof v === "number" || v instanceof Date) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

function formatSimuladoNumber(n: number | null | undefined) {
  return `Simulado ${String(n || 1).padStart(2, "0")}`;
}

function formatRelativeStudyTime(ms: number) {
  if (!ms) return "Sem atividade recente";
  const diff = Date.now() - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return "Estudou há menos de 1h";
  if (diff < day) return `Estudou há ${Math.max(1, Math.floor(diff / hour))}h`;
  const days = Math.max(1, Math.floor(diff / day));
  return days === 1 ? "Último estudo: ontem" : `Último estudo: há ${days} dias`;
}

const DASHBOARD_CACHE_TTL_MS = 60_000;
const DASHBOARD_CACHE_KEY = "aq.aluno.dashboard.cache";

function readDashboardCache(uid: string): DashboardCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${DASHBOARD_CACHE_KEY}.${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardCache;
    if (!parsed || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > DASHBOARD_CACHE_TTL_MS) return null;
    if (!Array.isArray(parsed.sessions) || !Array.isArray(parsed.themePerformance)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDashboardCache(uid: string, value: DashboardCache) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${DASHBOARD_CACHE_KEY}.${uid}`, JSON.stringify(value));
  } catch {
    // noop
  }
}

async function buildThemePerformance(items: SessionDoc[]): Promise<ThemePerformance[]> {
  const byTheme = new Map<string, { correct: number; wrong: number; total: number }>();
  const completed = items.filter((s) => s.status === "completed").slice(0, 8);

  const questionToSessionThemes = new Map<string, string[]>();
  const qidSet = new Set<string>();

  for (const session of completed) {
    const qids = normalizeQuestionIds(session.questionIds);
    const fallbackThemes = toStringList(session.filters?.temas);
    for (const qid of qids) {
      if (!qid) continue;
      qidSet.add(qid);
      if (fallbackThemes.length) {
        questionToSessionThemes.set(qid, fallbackThemes);
      }
    }
  }

  const allQids = Array.from(qidSet).slice(0, 120);
  const docs = await Promise.all(
    allQids.map(async (qid) => {
      try {
        const qSnap = await getDoc(doc(db, "questionsBank", qid));
        if (!qSnap.exists()) return [qid, [] as string[]] as const;
        const themes = extractQuestionThemes(qSnap.data() as QuestionThemeDoc);
        return [qid, themes] as const;
      } catch {
        return [qid, [] as string[]] as const;
      }
    })
  );

  const themeCache = new Map<string, string[]>(docs);

  for (const session of completed) {
    const qids = normalizeQuestionIds(session.questionIds);
    const fallbackThemes = toStringList(session.filters?.temas);

    for (const qid of qids) {
      const answer = session.answersMap?.[qid];
      if (!answer) continue;

      const fetchedThemes = themeCache.get(qid) ?? [];
      const themes =
        fetchedThemes.length > 0
          ? fetchedThemes
          : questionToSessionThemes.get(qid) ?? fallbackThemes;

      for (const theme of themes) {
        const current = byTheme.get(theme) ?? { correct: 0, wrong: 0, total: 0 };
        current.total += 1;
        if (answer.isCorrect) current.correct += 1;
        else current.wrong += 1;
        byTheme.set(theme, current);
      }
    }
  }

  return Array.from(byTheme.entries())
    .map(([theme, agg]) => ({
      theme,
      total: agg.total,
      correct: agg.correct,
      wrong: agg.wrong,
      accuracy: agg.total > 0 ? (agg.correct / agg.total) * 100 : 0,
    }))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return b.accuracy - a.accuracy;
    });
}

export default function DashboardClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [themePerformance, setThemePerformance] = useState<ThemePerformance[]>([]);

  async function load({ keepVisible = false }: { keepVisible?: boolean } = {}) {
    const u = auth.currentUser;
    if (!u) {
      setErr("Você precisa estar logado.");
      setLoading(false);
      return;
    }

    if (!keepVisible) setLoading(true);
    setErr("");

    try {
      const ref = collection(db, "users", u.uid, "sessions");
      const qy = query(ref, orderBy("updatedAt", "desc"), limit(80));

      const snap = await getDocs(qy);
      const items: SessionDoc[] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<SessionDoc, "id">),
      }))
      .filter((item) => item.id !== "__active_session_lock__" && item.control !== true && item.kind !== "session_lock");

      items.sort((a, b) => tsToMs(b.updatedAt) - tsToMs(a.updatedAt));
      setSessions(items);
      void buildThemePerformance(items)
        .then((perf) => {
          setThemePerformance(perf);
          writeDashboardCache(u.uid, {
            ts: Date.now(),
            sessions: items,
            themePerformance: perf,
          });
        })
        .catch((error) => {
          console.error("Falha ao calcular performance por tema:", error);
          writeDashboardCache(u.uid, {
            ts: Date.now(),
            sessions: items,
            themePerformance: [],
          });
        });
    } catch (error: unknown) {
      console.error(error);
      setErr(getErrorMessage(error, "Falha ao carregar dados do dashboard."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const u = auth.currentUser;
    if (u) {
      const cached = readDashboardCache(u.uid);
      if (cached) {
        setSessions(cached.sessions);
        setThemePerformance(cached.themePerformance);
        setLoading(false);
        void load({ keepVisible: true });
        return;
      }
    }
    void load();
  }, []);

  const stats = useMemo(() => {
    const totalSimulados = sessions.length;
    const concluidos = sessions.filter((s) => s.status === "completed").length;

    const totalQuestoes = sessions.reduce((acc, s) => acc + safeNum(s.totalQuestions), 0);
    const respondidas = sessions.reduce((acc, s) => acc + safeNum(s.answeredCount), 0);
    const acertos = sessions.reduce((acc, s) => acc + safeNum(s.correctCount), 0);

    const progressoPct = totalQuestoes > 0 ? (respondidas / totalQuestoes) * 100 : 0;
    const aproveitamentoPct = respondidas > 0 ? (acertos / respondidas) * 100 : 0;

    return {
      totalSimulados,
      concluidos,
      totalQuestoes,
      respondidas,
      acertos,
      progressoPct,
      aproveitamentoPct,
    };
  }, [sessions]);

  const lastSession = useMemo(() => sessions[0] ?? null, [sessions]);
  const inProgressSession = useMemo(
    () => sessions.find((session) => session.status !== "completed") ?? null,
    [sessions]
  );
  const recentTop3 = useMemo(() => sessions.slice(0, 3), [sessions]);
  const sessionNumberById = useMemo(() => {
    const map = new Map<string, number>();
    const ordered = [...sessions].sort((a, b) => {
      const aCreated = tsToMs(a.createdAt);
      const bCreated = tsToMs(b.createdAt);
      if (aCreated !== bCreated) return aCreated - bCreated;
      return tsToMs(a.updatedAt) - tsToMs(b.updatedAt);
    });
    ordered.forEach((session, index) => {
      map.set(session.id, index + 1);
    });
    return map;
  }, [sessions]);
  const topThemes = useMemo(() => [...themePerformance].sort((a, b) => b.accuracy - a.accuracy).slice(0, 3), [themePerformance]);
  const weakThemes = useMemo(() => [...themePerformance].sort((a, b) => a.accuracy - b.accuracy).slice(0, 3), [themePerformance]);
  const needsFocus = weakThemes[0] ?? null;
  const bestTheme = topThemes[0] ?? null;
  const performanceSeries = useMemo(() => {
    return [...sessions]
      .slice(0, 8)
      .reverse()
      .map((s) => {
        const total = safeNum(s.totalQuestions);
        const answered = total > 0 ? Math.min(safeNum(s.answeredCount), total) : safeNum(s.answeredCount);
        const pct =
          s.status === "completed"
            ? safeNum(s.scorePercent)
            : total > 0
            ? (answered / total) * 100
            : 0;
        const number = sessionNumberById.get(s.id) ?? 1;
        return {
          id: s.id,
          label: `S${String(number).padStart(2, "0")}`,
          value: Math.max(0, Math.min(100, pct)),
        };
      });
  }, [sessions, sessionNumberById]);
  const now = Date.now();
  const last7dStart = now - 7 * 24 * 60 * 60 * 1000;
  const prev7dStart = now - 14 * 24 * 60 * 60 * 1000;
  const sessionsLast7d = useMemo(
    () => sessions.filter((s) => tsToMs(s.updatedAt || s.createdAt) >= last7dStart),
    [sessions, last7dStart]
  );
  const sessionsPrev7d = useMemo(
    () =>
      sessions.filter((s) => {
        const ts = tsToMs(s.updatedAt || s.createdAt);
        return ts >= prev7dStart && ts < last7dStart;
      }),
    [sessions, prev7dStart, last7dStart]
  );
  const stats7d = useMemo(() => {
    const answered = sessionsLast7d.reduce((acc, s) => acc + safeNum(s.answeredCount), 0);
    const correct = sessionsLast7d.reduce((acc, s) => acc + safeNum(s.correctCount), 0);
    const completed = sessionsLast7d.filter((s) => s.status === "completed").length;
    const accuracy = answered > 0 ? (correct / answered) * 100 : 0;
    return { answered, correct, completed, accuracy };
  }, [sessionsLast7d]);
  const prevAccuracy7d = useMemo(() => {
    const answered = sessionsPrev7d.reduce((acc, s) => acc + safeNum(s.answeredCount), 0);
    const correct = sessionsPrev7d.reduce((acc, s) => acc + safeNum(s.correctCount), 0);
    return answered > 0 ? (correct / answered) * 100 : 0;
  }, [sessionsPrev7d]);
  const trendLabel = useMemo(() => {
    if (sessionsPrev7d.length === 0 || sessionsLast7d.length === 0) return "Sem comparação suficiente";
    const diff = stats7d.accuracy - prevAccuracy7d;
    if (Math.abs(diff) < 1) return "Tendência estável";
    return diff > 0 ? `Subiu ${Math.round(diff)} p.p. vs semana anterior` : `Caiu ${Math.round(Math.abs(diff))} p.p. vs semana anterior`;
  }, [sessionsPrev7d.length, sessionsLast7d.length, stats7d.accuracy, prevAccuracy7d]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100">Início</div>
          <div className="text-sm text-slate-600 mt-1 dark:text-slate-400">Carregando seus dados…</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-3xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div className="h-3 w-28 rounded-full bg-slate-200 animate-pulse dark:bg-slate-700" />
              <div className="mt-4 h-8 w-20 rounded-full bg-slate-200 animate-pulse dark:bg-slate-700" />
              <div className="mt-3 h-3 w-40 rounded-full bg-slate-200 animate-pulse dark:bg-slate-700" />
            </div>
          ))}
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="h-3 w-36 rounded-full bg-slate-200 animate-pulse dark:bg-slate-700" />
          <div className="mt-4 h-10 w-72 rounded-full bg-slate-200 animate-pulse dark:bg-slate-700" />
          <div className="mt-3 h-3 w-56 rounded-full bg-slate-200 animate-pulse dark:bg-slate-700" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100">Início</div>
          <div className="text-sm text-slate-600 mt-1 dark:text-slate-400">Visão geral do seu desempenho</div>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 font-semibold dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {err}
          </div>

          <Button className="mt-4" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  const progressoLabel =
    stats.totalQuestoes > 0 ? `${stats.respondidas} / ${stats.totalQuestoes}` : "—";

  const resolvidasLabel = stats.respondidas > 0 ? String(stats.respondidas) : "—";
  const aproveitamentoLabel = stats.respondidas > 0 ? formatPct(stats.aproveitamentoPct) : "—";

  const lastTitle = formatSimuladoNumber(lastSession ? sessionNumberById.get(lastSession.id) : null);
  const lastTotal = safeNum(lastSession?.totalQuestions);
  const lastAnsweredRaw = safeNum(lastSession?.answeredCount);
  const lastAnswered = lastTotal > 0 ? Math.min(lastAnsweredRaw, lastTotal) : lastAnsweredRaw;
  const lastCorrect = safeNum(lastSession?.correctCount);
  const lastStatus = lastSession?.status ?? "in_progress";

  const lastScore =
    lastStatus === "completed"
      ? formatPct(safeNum(lastSession?.scorePercent, 0))
      : lastTotal > 0
      ? formatPct((lastAnswered / lastTotal) * 100)
      : "—";

  const recommendation = needsFocus
    ? `Foque em ${needsFocus.theme}: ${needsFocus.accuracy.toFixed(0)}% de acerto em ${needsFocus.total} questões.`
    : "Complete mais simulados para liberar recomendações por tema.";
  const recommendationHref = needsFocus
    ? `/aluno/simulados/novo?tema=${encodeURIComponent(needsFocus.theme)}&qtd=15`
    : "/aluno/simulados/novo?qtd=10";
  const lastStudyLabel = formatRelativeStudyTime(tsToMs(lastSession?.updatedAt || lastSession?.createdAt));

  return (
    <div className="space-y-6 overflow-x-hidden">
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Seu painel de estudo</div>
            <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">Próximo passo recomendado</div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{lastStudyLabel}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              className="w-full"
              onClick={() =>
                router.push(
                  inProgressSession ? `/aluno/simulados/${inProgressSession.id}` : "/aluno/simulados/novo"
                )
              }
            >
              {inProgressSession ? "Continuar último simulado" : "Iniciar simulado"}
            </Button>

            <Button className="w-full" variant="secondary" onClick={() => router.push("/aluno/simulados/novo")}>
              Novo simulado
            </Button>

            <Button className="w-full" variant="secondary" onClick={() => router.push(recommendationHref)}>
              Reforçar tema fraco
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Últimos 7 dias</div>
            <div className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Resumo da semana</div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Respondidas</div>
                <div className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{stats7d.answered}</div>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Acerto</div>
                <div className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{formatPct(stats7d.accuracy)}</div>
              </div>
              <div className="rounded-2xl border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Concluídos</div>
                <div className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{stats7d.completed}</div>
              </div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300">{trendLabel}</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Plano sugerido</div>
            <div className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
              {needsFocus ? `Treino de ${needsFocus.theme}` : "Simulado rápido"}
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="text-sm text-slate-700 dark:text-slate-300">{recommendation}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={() => router.push(recommendationHref)}>Treino recomendado</Button>
              <Button variant="secondary" onClick={() => router.push("/aluno/simulados/novo?qtd=10")}>
                Sprint 10 questões
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Último simulado */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Último simulado</div>
              <button
                type="button"
                onClick={() => void load()}
                className="text-xs font-semibold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Atualizar
              </button>
            </div>
            <div className="mt-1 text-xl font-black text-slate-900 truncate dark:text-slate-100">{lastTitle}</div>

            {lastSession ? (
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Status:{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {lastStatus === "completed" ? "Concluído" : "Em andamento"}
                </span>{" "}
                • Respondidas:{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">{lastAnswered}</span>
                {lastTotal ? (
                  <>
                    {" "}
                    / <span className="font-semibold text-slate-900 dark:text-slate-100">{lastTotal}</span>
                  </>
                ) : null}
                <>
                  {" "}
                  • Acertos: <span className="font-semibold text-slate-900 dark:text-slate-100">{lastCorrect}</span>
                </>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Você ainda não iniciou nenhum simulado.
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="rounded-2xl border bg-slate-50 px-4 py-3 sm:min-w-[150px] dark:border-slate-700 dark:bg-slate-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {lastStatus === "completed" ? "Nota" : "Progresso"}
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{lastScore}</div>
            </div>

            {lastSession ? (
              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2">
                {lastStatus !== "completed" ? (
                  <Button className="w-full" onClick={() => router.push(`/aluno/simulados/${lastSession.id}`)}>
                    Continuar
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => router.push(`/aluno/simulados/${lastSession.id}/resultado`)}>
                    Ver resultado
                  </Button>
                )}

                <Button className="w-full" variant="secondary" onClick={() => router.push("/aluno/simulados")}>
                  Ver todos
                </Button>
              </div>
            ) : (
              <Button className="w-full sm:w-auto" onClick={() => router.push("/aluno/simulados")}>
                Ir para simulados
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Desempenho */}
      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Desempenho recente</div>
          <div className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Evolução dos últimos simulados</div>
        </CardHeader>
        <CardBody>
          {performanceSeries.length < 2 ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Complete mais simulados para visualizar o gráfico de desempenho.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <svg viewBox="0 0 520 180" className="h-44 min-w-[520px] w-full">
                  <defs>
                    <linearGradient id="aqLine" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity="1" />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  {[0, 25, 50, 75, 100].map((tick) => {
                    const y = 12 + (100 - tick) * 1.35;
                    return (
                      <line
                        key={tick}
                        x1="20"
                        x2="500"
                        y1={y}
                        y2={y}
                        stroke="currentColor"
                        className="text-slate-300 dark:text-slate-700"
                        strokeDasharray="4 4"
                      />
                    );
                  })}
                  <polyline
                    fill="none"
                    stroke="url(#aqLine)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={performanceSeries
                      .map((item, index) => {
                        const step = performanceSeries.length > 1 ? 480 / (performanceSeries.length - 1) : 0;
                        const x = 20 + index * step;
                        const y = 12 + (100 - item.value) * 1.35;
                        return `${x},${y}`;
                      })
                      .join(" ")}
                  />
                  {performanceSeries.map((item, index) => {
                    const step = performanceSeries.length > 1 ? 480 / (performanceSeries.length - 1) : 0;
                    const x = 20 + index * step;
                    const y = 12 + (100 - item.value) * 1.35;
                    return (
                      <g key={item.id}>
                        <circle cx={x} cy={y} r="4.5" fill="#0f172a" className="dark:fill-slate-100" />
                        <text x={x} y="170" textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[11px]">
                          {item.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Linha de tendência por nota/progresso dos últimos simulados.
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Diagnóstico */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tema para focar estudo</div>
            <div className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
              {needsFocus ? needsFocus.theme : "Sem dados suficientes"}
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="text-sm text-slate-700 dark:text-slate-300">{recommendation}</div>
            {needsFocus ? (
              <div className="rounded-2xl border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Taxa de acerto atual</div>
                <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                  {formatPct(needsFocus.accuracy)}
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Seu melhor tema</div>
            <div className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
              {bestTheme ? bestTheme.theme : "Sem dados suficientes"}
            </div>
          </CardHeader>
          <CardBody className="space-y-3">
            {bestTheme ? (
              <>
                <div className="text-sm text-slate-700 dark:text-slate-300">
                  Aproveite o bom momento para manter consistência nesse tema.
                </div>
                <div className="rounded-2xl border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Acerto médio</div>
                  <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                    {formatPct(bestTheme.accuracy)}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-700 dark:text-slate-300">
                Responda mais questões para visualizar seu melhor desempenho por tema.
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {themePerformance.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Temas com melhor desempenho</div>
            </CardHeader>
            <CardBody className="space-y-3">
              {topThemes.map((t) => (
                <div key={`top-${t.theme}`} className="rounded-2xl border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{t.theme}</div>
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{formatPct(t.accuracy)}</div>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(0, t.accuracy))}%` }} />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Temas para reforçar</div>
            </CardHeader>
            <CardBody className="space-y-3">
              {weakThemes.map((t) => (
                <div key={`weak-${t.theme}`} className="rounded-2xl border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{t.theme}</div>
                    <div className="text-xs font-bold text-amber-700 dark:text-amber-400">{formatPct(t.accuracy)}</div>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, Math.max(0, t.accuracy))}%` }} />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {/* Recentes */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-black text-slate-900 dark:text-slate-100">Simulados recentes</div>
            <div className="text-sm text-slate-600 dark:text-slate-400">Seus últimos 3 simulados</div>
          </div>

          <Button className="w-full sm:w-auto" variant="secondary" onClick={() => router.push("/aluno/simulados")}>
            Ver todos
          </Button>
        </div>

        {recentTop3.length === 0 ? (
          <div className="rounded-3xl border bg-white p-6 shadow-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
            Você ainda não iniciou nenhum simulado.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {recentTop3.map((s) => {
              const title = formatSimuladoNumber(sessionNumberById.get(s.id));
              const total = safeNum(s.totalQuestions);
              const answeredRaw = safeNum(s.answeredCount);
              const answered = total > 0 ? Math.min(answeredRaw, total) : answeredRaw;
              const correct = safeNum(s.correctCount);
              const status = s.status ?? "in_progress";

              const pct =
                status === "completed"
                  ? safeNum(s.scorePercent, 0)
                  : total > 0
                  ? (answered / total) * 100
                  : 0;

              const badgeCls =
                status === "completed"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30";

              const badgeText = status === "completed" ? "Concluído" : "Em andamento";

              return (
                <Card key={s.id} className="overflow-hidden">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Simulado</div>
                        <div className="mt-1 font-black text-slate-900 truncate dark:text-slate-100">{title}</div>
                      </div>

                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-3 py-1 text-xs font-bold",
                          badgeCls
                        )}
                      >
                        {badgeText}
                      </span>
                    </div>

                    <div className="rounded-2xl border bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {status === "completed" ? "Nota" : "Progresso"}
                        </div>
                        <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {answered}/{total || "—"}
                        </div>
                      </div>

                      <div className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">
                        {formatPct(pct)}
                      </div>

                      <div className="mt-3 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-slate-900 transition-all dark:bg-slate-100"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>

                      <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        Acertos:{" "}
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{correct}</span>
                      </div>
                    </div>

                    <div className="flex items-stretch gap-2">
                      {status !== "completed" ? (
                        <Button className="min-w-0 flex-1" onClick={() => router.push(`/aluno/simulados/${s.id}`)}>
                          Continuar
                        </Button>
                      ) : (
                        <Button className="min-w-0 flex-1" onClick={() => router.push(`/aluno/simulados/${s.id}/resultado`)}>
                          Resultado
                        </Button>
                      )}

                      <Button
                        variant="secondary"
                        onClick={() => router.push("/aluno/simulados")}
                        className="shrink-0 px-4"
                        title="Ver todos"
                      >
                        Todos
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Cards principais (compactos) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="space-y-1">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Progresso</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {stats.totalQuestoes > 0 ? formatPct(stats.progressoPct) : "—"}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300">{progressoLabel}</div>
          </CardHeader>
          <CardBody>
            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-900 transition-all dark:bg-slate-100"
                style={{ width: `${Math.min(100, Math.max(0, stats.progressoPct))}%` }}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Questões resolvidas</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{resolvidasLabel}</div>
            <div className="text-xs text-slate-600 dark:text-slate-300">Total confirmadas</div>
          </CardHeader>
          <CardBody>
            <div className="rounded-2xl border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Acertos</div>
              <div className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{stats.acertos}</div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Aproveitamento</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">{aproveitamentoLabel}</div>
            <div className="text-xs text-slate-600 dark:text-slate-300">Base: {stats.respondidas}</div>
          </CardHeader>
          <CardBody>
            <div className="rounded-2xl border bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Concluídos</div>
              <div className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">
                {stats.concluidos} / {stats.totalSimulados}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
