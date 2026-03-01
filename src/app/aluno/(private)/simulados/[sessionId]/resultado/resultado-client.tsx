"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SessionDoc = {
  id: string;
  title?: string;
  titleDisplay?: string;
  status?: "in_progress" | "completed";
  totalQuestions?: number;
  answeredCount?: number;
  correctCount?: number;
  scorePercent?: number;
};

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function formatPct(v: number) {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v)}%`;
}
function cleanTitle(raw?: string) {
  const base = String(raw ?? "").trim();
  if (!base) return "Simulado";
  const parts = base.split("•").map((p) => p.trim()).filter(Boolean);
  const main = parts[0] || "Simulado";
  const rest = parts
    .slice(1)
    .filter((p) => p.toLowerCase() !== "todos" && p.toLowerCase() !== "todas");
  return rest.length ? `${main} • ${rest.join(" • ")}` : main;
}

export default function ResultadoClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [session, setSession] = useState<SessionDoc | null>(null);

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
      const ref = doc(db, "users", u.uid, "sessions", sessionId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error("Sessão não encontrada.");
      setSession({ id: snap.id, ...(snap.data() as any) });
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Falha ao carregar resultado.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-black text-slate-900">Resultado final</div>
        </CardHeader>
        <CardBody className="text-slate-600">Carregando…</CardBody>
      </Card>
    );
  }

  if (err) {
    return (
      <Card>
        <CardHeader>
          <div className="text-lg font-black text-slate-900">Resultado final</div>
        </CardHeader>
        <CardBody>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 font-semibold">
            {err}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => router.push("/aluno/simulados")}>
              Voltar
            </Button>
            <Button onClick={load}>Tentar novamente</Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!session) return null;

  const title = session.titleDisplay?.trim() || cleanTitle(session.title);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500">Resultado final</div>
            <div className="mt-1 text-2xl font-black text-slate-900 truncate">{title}</div>
            <div className="mt-1 text-sm text-slate-600">
              Status:{" "}
              <span className="font-semibold text-slate-900">
                {session.status ?? "completed"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => router.push("/aluno/simulados")}>
              Voltar para Simulados
            </Button>
            <Button onClick={() => router.push(`/aluno/simulados/${sessionId}`)}>
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
              <div className="text-sm text-slate-500">{x.label}</div>
              <div className="mt-2 text-4xl font-black text-slate-900">{x.value}</div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="text-xl font-black text-slate-900">Resumo</div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="text-slate-700">
            Você respondeu <b>{stats.answered}</b> de <b>{stats.total}</b> questões.
          </div>
          <div className="text-slate-700">
            Aproveitamento: <b>{formatPct(stats.score)}</b>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push("/aluno/simulados/novo")}>
              Novo simulado
            </Button>
            <Button variant="secondary" onClick={() => router.push("/aluno/simulados")}>
              Ver simulados
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
