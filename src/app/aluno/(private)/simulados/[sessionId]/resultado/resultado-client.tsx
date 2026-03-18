"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SessionDoc = {
  id: string;
  status?: "in_progress" | "completed";
  totalQuestions?: number;
  answeredCount?: number;
  correctCount?: number;
  scorePercent?: number;
  createdAt?: unknown;
  filters?: {
    temas?: unknown;
  };
  control?: boolean;
  kind?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function safeNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function formatPct(v: number) {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v)}%`;
}
type TimestampLike = { toMillis?: () => number };

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as TimestampLike).toMillis === "function"
  ) {
    return (value as TimestampLike).toMillis!();
  }
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function formatStatus(status: SessionDoc["status"]) {
  if (status === "completed") return "Completo";
  if (status === "in_progress") return "Em andamento";
  return "—";
}

export default function ResultadoClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [session, setSession] = useState<SessionDoc | null>(null);
  const [simuladoNumero, setSimuladoNumero] = useState<number | null>(null);

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
      const sessionsRef = collection(db, "users", u.uid, "sessions");
      const ref = doc(sessionsRef, sessionId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error("Sessão não encontrada.");
      setSession({ id: snap.id, ...(snap.data() as Omit<SessionDoc, "id">) });

      const listSnap = await getDocs(sessionsRef);
      const allSessions = listSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SessionDoc, "id">),
      }))
      .filter((item) => item.id !== "__active_session_lock__" && item.control !== true && item.kind !== "session_lock");

      allSessions.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
      const index = allSessions.findIndex((item) => item.id === sessionId);
      setSimuladoNumero(index >= 0 ? index + 1 : null);
    } catch (error: unknown) {
      console.error(error);
      setErr(getErrorMessage(error, "Falha ao carregar resultado."));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const total = safeNum(session?.totalQuestions);
    const answeredRaw = safeNum(session?.answeredCount);
    const answered = total > 0 ? Math.min(answeredRaw, total) : answeredRaw;
    const correct = safeNum(session?.correctCount);
    const errors = Math.max(0, answered - correct);
    const score =
      session?.scorePercent != null
        ? safeNum(session?.scorePercent)
        : total > 0
        ? (correct / total) * 100
        : 0;
    return { total, answered, correct, errors, score };
  }, [session]);

  const temasResumo = useMemo(() => {
    const temas = toStringList(session?.filters?.temas);
    if (!temas.length) return "Todos os temas selecionados";
    if (temas.length <= 3) return temas.join(", ");
    return `${temas.slice(0, 3).join(", ")}...`;
  }, [session]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100">Resultado final</div>
        </CardHeader>
        <CardBody className="text-slate-600 dark:text-slate-300">Carregando…</CardBody>
      </Card>
    );
  }

  if (err) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100">Resultado final</div>
        </CardHeader>
        <CardBody>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 font-semibold dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300">
            {err}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => router.push("/aluno/simulados")}>
              Voltar
            </Button>
            <Button className="w-full sm:w-auto" onClick={load}>Tentar novamente</Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!session) return null;

  const title = `Simulado ${String(simuladoNumero ?? 1).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Resultado final</div>
            <div className="mt-1 text-2xl font-black text-slate-900 truncate dark:text-slate-100">{title}</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Status:{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatStatus(session.status)}
              </span>
            </div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Temas:{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">{temasResumo}</span>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => router.push("/aluno/simulados")}>
              Voltar para Simulados
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => router.push(`/aluno/simulados/${sessionId}`)}>
              Revisar questões
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Nota", value: formatPct(stats.score) },
          { label: "Acertos", value: String(stats.correct) },
          { label: "Erros", value: String(stats.errors) },
          { label: "Total", value: String(stats.total) },
        ].map((x) => (
          <Card key={x.label}>
            <CardHeader>
              <div className="text-sm text-slate-500 dark:text-slate-400">{x.label}</div>
              <div className="mt-2 text-4xl font-black text-slate-900 dark:text-slate-100">{x.value}</div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100">Resumo</div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="text-slate-700 dark:text-slate-200">
            Você respondeu <b>{stats.answered}</b> de <b>{stats.total}</b> questões.
          </div>
          <div className="text-slate-700 dark:text-slate-200">
            Aproveitamento: <b>{formatPct(stats.score)}</b>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button className="w-full sm:w-auto" onClick={() => router.push("/aluno/simulados/novo")}>
              Novo simulado
            </Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={() => router.push("/aluno/simulados")}>
              Ver simulados
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
