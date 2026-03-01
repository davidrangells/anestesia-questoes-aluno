"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";
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
  title?: string;
};

type TimestampLike = {
  toMillis?: () => number;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
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

/**
 * Remove "Todos/Todas" do título quando não há filtro.
 * Ex:
 *  "Simulado • Todas • Todos • Todos" -> "Simulado"
 *  "Simulado • TSA • R1 • Todos" -> "Simulado • TSA • R1"
 */
function cleanSessionTitle(raw?: string) {
  const base = (raw ?? "").trim();
  if (!base) return "Simulado";

  const parts = base
    .split("•")
    .map((p) => p.trim())
    .filter(Boolean);

  if (!parts.length) return "Simulado";

  const head = parts[0] || "Simulado";
  const tail = parts
    .slice(1)
    .filter((p) => {
      const t = p.toLowerCase();
      return t !== "todos" && t !== "todas";
    });

  if (!tail.length) return head;
  return `${head} • ${tail.join(" • ")}`;
}

export default function DashboardClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sessions, setSessions] = useState<SessionDoc[]>([]);

  async function load() {
    const u = auth.currentUser;
    if (!u) {
      setErr("Você precisa estar logado.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const ref = collection(db, "users", u.uid, "sessions");
      const qy = query(ref);

      const snap = await getDocs(qy);
      const items: SessionDoc[] = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<SessionDoc, "id">),
      }));

      items.sort((a, b) => tsToMs(b.updatedAt) - tsToMs(a.updatedAt));
      setSessions(items);
    } catch (error: unknown) {
      console.error(error);
      setErr(getErrorMessage(error, "Falha ao carregar dados do dashboard."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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
  const recentTop3 = useMemo(() => sessions.slice(0, 3), [sessions]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-3xl font-black text-slate-900">Início</div>
          <div className="text-sm text-slate-600 mt-1">Carregando seus dados…</div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-3xl border bg-white p-6 shadow-sm">
              <div className="h-3 w-28 rounded-full bg-slate-200 animate-pulse" />
              <div className="mt-4 h-8 w-20 rounded-full bg-slate-200 animate-pulse" />
              <div className="mt-3 h-3 w-40 rounded-full bg-slate-200 animate-pulse" />
            </div>
          ))}
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="h-3 w-36 rounded-full bg-slate-200 animate-pulse" />
          <div className="mt-4 h-10 w-72 rounded-full bg-slate-200 animate-pulse" />
          <div className="mt-3 h-3 w-56 rounded-full bg-slate-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-3xl font-black text-slate-900">Início</div>
          <div className="text-sm text-slate-600 mt-1">Visão geral do seu desempenho</div>
        </div>

        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 font-semibold">
            {err}
          </div>

          <Button className="mt-4" onClick={load}>
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

  const lastTitle = cleanSessionTitle(lastSession?.title);
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

  return (
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-3xl font-black text-slate-900">Início</div>
          <div className="text-sm text-slate-600 mt-1">Visão geral do seu desempenho</div>
        </div>

        <Button variant="secondary" onClick={load} className="w-full sm:w-auto">
          Atualizar
        </Button>
      </div>

      {/* Último simulado */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500">Último simulado</div>
            <div className="mt-1 text-xl font-black text-slate-900 truncate">{lastTitle}</div>

            {lastSession ? (
              <div className="mt-2 text-sm text-slate-600">
                Status:{" "}
                <span className="font-semibold text-slate-900">
                  {lastStatus === "completed" ? "Concluído" : "Em andamento"}
                </span>{" "}
                • Respondidas:{" "}
                <span className="font-semibold text-slate-900">{lastAnswered}</span>
                {lastTotal ? (
                  <>
                    {" "}
                    / <span className="font-semibold text-slate-900">{lastTotal}</span>
                  </>
                ) : null}
                <>
                  {" "}
                  • Acertos: <span className="font-semibold text-slate-900">{lastCorrect}</span>
                </>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">
                Você ainda não iniciou nenhum simulado.
              </div>
            )}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="rounded-2xl border bg-slate-50 px-4 py-3 sm:min-w-[160px]">
              <div className="text-xs font-semibold text-slate-500">
                {lastStatus === "completed" ? "Nota" : "Progresso"}
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900">{lastScore}</div>
            </div>

            {lastSession ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                {lastStatus !== "completed" ? (
                  <Button className="w-full sm:w-auto" onClick={() => router.push(`/aluno/simulados/${lastSession.id}`)}>
                    Continuar
                  </Button>
                ) : (
                  <Button className="w-full sm:w-auto" onClick={() => router.push(`/aluno/simulados/${lastSession.id}/resultado`)}>
                    Ver resultado
                  </Button>
                )}

                <Button className="w-full sm:w-auto" variant="secondary" onClick={() => router.push("/aluno/simulados")}>
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

      {/* Recentes */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-lg font-black text-slate-900">Simulados recentes</div>
            <div className="text-sm text-slate-600">Seus últimos 3 simulados</div>
          </div>

          <Button className="w-full sm:w-auto" variant="secondary" onClick={() => router.push("/aluno/simulados")}>
            Ver todos
          </Button>
        </div>

        {recentTop3.length === 0 ? (
          <div className="rounded-3xl border bg-white p-6 shadow-sm text-slate-600">
            Você ainda não iniciou nenhum simulado.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {recentTop3.map((s) => {
              const title = cleanSessionTitle(s.title);
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
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-amber-50 text-amber-700 border-amber-200";

              const badgeText = status === "completed" ? "Concluído" : "Em andamento";

              return (
                <Card key={s.id} className="overflow-hidden">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-500">Simulado</div>
                        <div className="mt-1 font-black text-slate-900 truncate">{title}</div>
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

                    <div className="rounded-2xl border bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-slate-500">
                          {status === "completed" ? "Nota" : "Progresso"}
                        </div>
                        <div className="text-xs font-semibold text-slate-600">
                          {answered}/{total || "—"}
                        </div>
                      </div>

                      <div className="mt-1 text-2xl font-black text-slate-900">
                        {formatPct(pct)}
                      </div>

                      <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-slate-900 transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>

                      <div className="mt-2 text-xs text-slate-600">
                        Acertos:{" "}
                        <span className="font-semibold text-slate-900">{correct}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      {status !== "completed" ? (
                        <Button className="flex-1" onClick={() => router.push(`/aluno/simulados/${s.id}`)}>
                          Continuar
                        </Button>
                      ) : (
                        <Button className="flex-1" onClick={() => router.push(`/aluno/simulados/${s.id}/resultado`)}>
                          Resultado
                        </Button>
                      )}

                      <Button
                        variant="secondary"
                        onClick={() => router.push("/aluno/simulados")}
                        className="w-full px-4 sm:w-auto"
                        title="Ver todos"
                      >
                        ⋯
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
            <div className="text-xs font-semibold text-slate-500">Progresso</div>
            <div className="text-2xl font-black text-slate-900">
              {stats.totalQuestoes > 0 ? formatPct(stats.progressoPct) : "—"}
            </div>
            <div className="text-xs text-slate-600">{progressoLabel}</div>
          </CardHeader>
          <CardBody>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-900 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, stats.progressoPct))}%` }}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <div className="text-xs font-semibold text-slate-500">Questões resolvidas</div>
            <div className="text-2xl font-black text-slate-900">{resolvidasLabel}</div>
            <div className="text-xs text-slate-600">Total confirmadas</div>
          </CardHeader>
          <CardBody>
            <div className="rounded-2xl border bg-slate-50 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Acertos</div>
              <div className="mt-1 text-lg font-black text-slate-900">{stats.acertos}</div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <div className="text-xs font-semibold text-slate-500">Aproveitamento</div>
            <div className="text-2xl font-black text-slate-900">{aproveitamentoLabel}</div>
            <div className="text-xs text-slate-600">Base: {stats.respondidas}</div>
          </CardHeader>
          <CardBody>
            <div className="rounded-2xl border bg-slate-50 p-3">
              <div className="text-[11px] font-semibold text-slate-500">Concluídos</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {stats.concluidos} / {stats.totalSimulados}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
