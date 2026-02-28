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
  updatedAt?: any;
  title?: string;
};

function formatPct(v: number) {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v)}%`;
}

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function tsToMs(v: any): number {
  if (!v) return 0;
  if (typeof v === "object" && typeof v?.toMillis === "function") return v.toMillis();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function cleanTitle(raw?: string) {
  const titleRaw = (raw ?? "").trim();
  if (!titleRaw) return { title: "Simulado", subtitle: "" };

  const parts = titleRaw
    .split("•")
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((p) => !["todos", "todas", "todo", "toda"].includes(p.toLowerCase()));

  const uniq: string[] = [];
  for (const p of parts) {
    if (!uniq.some((u) => u.toLowerCase() === p.toLowerCase())) uniq.push(p);
  }

  const title = uniq[0] || "Simulado";
  const subtitle = uniq.slice(1).join(" • ");
  return { title, subtitle };
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
      const items: SessionDoc[] = [];

      snap.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...(docSnap.data() as any),
        });
      });

      items.sort((a, b) => tsToMs(b.updatedAt) - tsToMs(a.updatedAt));
      setSessions(items);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Falha ao carregar dados do dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <div className="text-3xl font-black text-slate-900">Dashboard</div>
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
      </div>
    );
  }

  if (err) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-3xl font-black text-slate-900">Dashboard</div>
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

  const { title: lastTitle } = cleanTitle(lastSession?.title);

  const lastTotal = safeNum(lastSession?.totalQuestions);
  const lastAnswered = safeNum(lastSession?.answeredCount);
  const lastCorrect = safeNum(lastSession?.correctCount);
  const lastStatus = lastSession?.status ?? "in_progress";

  const lastScore =
    lastStatus === "completed"
      ? formatPct(safeNum(lastSession?.scorePercent, 0))
      : lastTotal > 0
      ? formatPct((lastAnswered / lastTotal) * 100)
      : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-3xl font-black text-slate-900">Dashboard</div>
          <div className="text-sm text-slate-600 mt-1">Visão geral do seu desempenho</div>
        </div>

        <Button variant="secondary" onClick={load}>
          Atualizar
        </Button>
      </div>

      {/* Último simulado */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                {" "}
                • Acertos: <span className="font-semibold text-slate-900">{lastCorrect}</span>
              </div>
            ) : (
              <div className="mt-2 text-sm text-slate-600">
                Você ainda não iniciou nenhum simulado.
              </div>
            )}
          </div>

          <div className="flex flex-col sm:items-end gap-2">
            <div className="rounded-2xl border bg-slate-50 px-4 py-3">
              <div className="text-xs font-semibold text-slate-500">
                {lastStatus === "completed" ? "Nota" : "Progresso"}
              </div>
              <div className="mt-1 text-2xl font-black text-slate-900">{lastScore}</div>
            </div>

            {lastSession ? (
              <div className="flex gap-2">
                {lastStatus !== "completed" ? (
                  <Button onClick={() => router.push(`/aluno/simulados/${lastSession.id}`)}>
                    Continuar
                  </Button>
                ) : (
                  <Button onClick={() => router.push(`/aluno/simulados/${lastSession.id}/resultado`)}>
                    Ver resultado
                  </Button>
                )}

                <Button variant="secondary" onClick={() => router.push("/aluno/simulados")}>
                  Ver todos
                </Button>
              </div>
            ) : (
              <Button onClick={() => router.push("/aluno/simulados")}>
                Ir para simulados
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Cards pequenos */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="text-sm text-slate-500">Progresso</div>
            <div className="mt-2 text-3xl font-black text-slate-900">
              {stats.totalQuestoes > 0 ? formatPct(stats.progressoPct) : "—"}
            </div>
            <div className="mt-2 text-sm text-slate-600">
              {progressoLabel} questões respondidas
            </div>
          </CardHeader>
          <CardBody>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-900 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, stats.progressoPct))}%` }}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm text-slate-500">Questões resolvidas</div>
            <div className="mt-2 text-3xl font-black text-slate-900">{resolvidasLabel}</div>
            <div className="mt-2 text-sm text-slate-600">
              Total de respostas confirmadas
            </div>
          </CardHeader>
          <CardBody>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">Acertos</div>
              <div className="mt-1 text-lg font-black text-slate-900">{stats.acertos}</div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-sm text-slate-500">Aproveitamento</div>
            <div className="mt-2 text-3xl font-black text-slate-900">{aproveitamentoLabel}</div>
            <div className="mt-2 text-sm text-slate-600">
              Baseado em {stats.respondidas} respostas
            </div>
          </CardHeader>
          <CardBody>
            <div className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-xs font-semibold text-slate-500">Concluídos</div>
              <div className="mt-1 text-lg font-black text-slate-900">
                {stats.concluidos} / {stats.totalSimulados}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Recentes (opcional manter) */}
      {recentTop3.length ? (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-lg font-black text-slate-900">Simulados recentes</div>
              <div className="text-sm text-slate-600">Seus últimos 3 simulados</div>
            </div>

            <Button variant="secondary" onClick={() => router.push("/aluno/simulados")}>
              Ver todos
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {recentTop3.map((s) => {
              const { title } = cleanTitle(s.title);
              const total = safeNum(s.totalQuestions);
              const answered = safeNum(s.answeredCount);
              const correct = safeNum(s.correctCount);
              const status = s.status ?? "in_progress";

              const pct =
                status === "completed"
                  ? safeNum(s.scorePercent, 0)
                  : total > 0
                  ? (answered / total) * 100
                  : 0;

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
                          status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        )}
                      >
                        {status === "completed" ? "Concluído" : "Em andamento"}
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

                      <div className="mt-1 text-2xl font-black text-slate-900">{formatPct(pct)}</div>

                      <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-slate-900 transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>

                      <div className="mt-2 text-xs text-slate-600">
                        Acertos: <span className="font-semibold text-slate-900">{correct}</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
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
                        className="px-4"
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
        </div>
      ) : null}
    </div>
  );
}