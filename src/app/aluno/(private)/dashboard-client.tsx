"use client";

import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query } from "firebase/firestore";

import { Card, CardHeader, CardBody } from "@/components/ui/card";

type SessionDoc = {
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

export default function DashboardClient() {
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
        items.push(docSnap.data() as SessionDoc);
      });

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

          <button
            onClick={load}
            className="mt-4 rounded-2xl px-5 py-3 bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const progressoLabel =
    stats.totalQuestoes > 0
      ? `${stats.respondidas} / ${stats.totalQuestoes}`
      : "—";

  const resolvidasLabel = stats.respondidas > 0 ? String(stats.respondidas) : "—";
  const aproveitamentoLabel = stats.respondidas > 0 ? formatPct(stats.aproveitamentoPct) : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-3xl font-black text-slate-900">Dashboard</div>
          <div className="text-sm text-slate-600 mt-1">Visão geral do seu desempenho</div>
        </div>

        <button
          onClick={load}
          className="rounded-2xl px-5 py-3 border bg-white font-semibold text-slate-900 hover:bg-slate-50 transition"
        >
          Atualizar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {/* Progresso */}
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

        {/* Questões resolvidas */}
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

        {/* Aproveitamento */}
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
              <div className="text-xs font-semibold text-slate-500">Simulados concluídos</div>
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