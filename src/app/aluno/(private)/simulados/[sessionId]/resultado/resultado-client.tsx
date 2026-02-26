"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type SessionDoc = {
  id: string;
  title?: string;
  status?: "in_progress" | "completed" | string;
  totalQuestions?: number;
  answeredCount?: number;
  correctCount?: number;
  scorePercent?: number;

  // opcional: se você realmente salvar isso na sessão
  attemptId?: string;
};

type AttemptDoc = {
  id: string;
  title?: string;
  status?: "in_progress" | "completed" | string;
  totalQuestions?: number;
  answeredCount?: number;
  correctCount?: number;
  scorePercent?: number;
};

function pct(n?: number) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export default function ResultadoClient({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionDoc | null>(null);
  const [attempt, setAttempt] = useState<AttemptDoc | null>(null);
  const [err, setErr] = useState("");

  async function load() {
    const u = auth.currentUser;
    if (!u) {
      setErr("Você precisa estar logado.");
      setLoading(false);
      return;
    }

    if (!sessionId) {
      setErr("sessionId inválido.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErr("");

    try {
      // 1) carrega a sessão (fonte principal)
      const sessRef = doc(db, "users", u.uid, "sessions", sessionId);
      const sessSnap = await getDoc(sessRef);

      if (!sessSnap.exists()) {
        setErr("Sessão não encontrada.");
        setSession(null);
        setAttempt(null);
        setLoading(false);
        return;
      }

      const sessData = sessSnap.data() as any;
      const sess: SessionDoc = {
        id: sessSnap.id,
        title: sessData?.title,
        status: sessData?.status,
        totalQuestions: sessData?.totalQuestions,
        answeredCount: sessData?.answeredCount,
        correctCount: sessData?.correctCount,
        scorePercent: sessData?.scorePercent,
        attemptId: sessData?.attemptId, // pode não existir, ok
      };

      setSession(sess);

      // 2) tenta carregar attempt somente se existir attemptId
      const attemptId = sess.attemptId;
      if (attemptId) {
        try {
          const attRef = doc(db, "users", u.uid, "attempts", attemptId);
          const attSnap = await getDoc(attRef);

          if (attSnap.exists()) {
            const attData = attSnap.data() as any;
            const att: AttemptDoc = {
              id: attSnap.id,
              title: attData?.title,
              status: attData?.status,
              totalQuestions: attData?.totalQuestions,
              answeredCount: attData?.answeredCount,
              correctCount: attData?.correctCount,
              scorePercent: attData?.scorePercent,
            };
            setAttempt(att);
          } else {
            // não quebra a tela: só não usa attempt
            setAttempt(null);
          }
        } catch {
          // não quebra a tela: só não usa attempt
          setAttempt(null);
        }
      } else {
        setAttempt(null);
      }
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
  }, [sessionId]);

  const data = useMemo(() => {
    const total = Number(attempt?.totalQuestions ?? session?.totalQuestions ?? 0) || 0;
    const correct = Number(attempt?.correctCount ?? session?.correctCount ?? 0) || 0;
    const answered = Number(attempt?.answeredCount ?? session?.answeredCount ?? 0) || 0;
    const wrong = Math.max(0, total - correct);

    const scoreRaw =
      attempt?.scorePercent ??
      session?.scorePercent ??
      (total > 0 ? (correct / total) * 100 : 0);

    const score = pct(scoreRaw);

    return { total, correct, wrong, answered, score };
  }, [attempt, session]);

  if (loading) {
    return (
      <div className="rounded-3xl border bg-white shadow-sm p-6 text-slate-500">
        Carregando resultado…
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-3xl border bg-white shadow-sm p-6">
        <div className="text-lg font-black text-slate-900">Resultado</div>
        <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
          {err}
        </div>
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <Link
            href="/aluno/simulados"
            className="rounded-2xl px-5 py-3 border bg-white font-semibold hover:bg-slate-50 transition text-center"
          >
            Voltar para Simulados
          </Link>
          <button
            onClick={load}
            className="rounded-2xl px-5 py-3 bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border bg-white shadow-sm p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">Resultado final</div>
            <div className="text-2xl font-black text-slate-900 truncate">
              {attempt?.title || session?.title || "Simulado"}
            </div>
            <div className="text-sm text-slate-500 mt-1">
              Status:{" "}
              <span className="font-semibold">
                {attempt?.status || session?.status || "completed"}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href="/aluno/simulados"
              className="rounded-2xl px-5 py-3 border bg-white font-semibold hover:bg-slate-50 transition"
            >
              Voltar para Simulados
            </Link>
            <Link
              href={`/aluno/simulados/${sessionId}`}
              className="rounded-2xl px-5 py-3 bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
            >
              Revisar questões
            </Link>
          </div>
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid gap-5 md:grid-cols-4">
        <div className="rounded-3xl border bg-white shadow-sm p-6">
          <div className="text-sm text-slate-500">Nota</div>
          <div className="mt-2 text-3xl font-black text-slate-900">{data.score}%</div>
        </div>

        <div className="rounded-3xl border bg-white shadow-sm p-6">
          <div className="text-sm text-slate-500">Acertos</div>
          <div className="mt-2 text-3xl font-black text-slate-900">{data.correct}</div>
        </div>

        <div className="rounded-3xl border bg-white shadow-sm p-6">
          <div className="text-sm text-slate-500">Erros</div>
          <div className="mt-2 text-3xl font-black text-slate-900">{data.wrong}</div>
        </div>

        <div className="rounded-3xl border bg-white shadow-sm p-6">
          <div className="text-sm text-slate-500">Total</div>
          <div className="mt-2 text-3xl font-black text-slate-900">{data.total}</div>
        </div>
      </div>

      {/* Resumo */}
      <div className="rounded-3xl border bg-white shadow-sm p-6">
        <div className="text-lg font-black text-slate-900">Resumo</div>
        <div className="mt-2 text-slate-700">
          Você respondeu <span className="font-black">{data.answered}</span> de{" "}
          <span className="font-black">{data.total}</span> questões.
        </div>
        <div className="mt-1 text-slate-700">
          Aproveitamento: <span className="font-black">{data.score}%</span>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <Link
            href="/aluno/simulados/novo"
            className="rounded-2xl px-6 py-3 bg-slate-900 text-white font-semibold hover:bg-slate-800 transition text-center"
          >
            Novo simulado
          </Link>
          <Link
            href="/aluno/provas"
            className="rounded-2xl px-6 py-3 border bg-white font-semibold hover:bg-slate-50 transition text-center"
          >
            Ver provas
          </Link>
        </div>
      </div>
    </div>
  );
}