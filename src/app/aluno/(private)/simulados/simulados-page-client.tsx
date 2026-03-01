"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type SessionDoc = {
  id: string;
  title?: string;
  titleDisplay?: string; // ✅ novo (melhor para mostrar)
  status?: "in_progress" | "completed" | string;
  totalQuestions?: number;
  answeredCount?: number;
  correctCount?: number;
  scorePercent?: number;
  updatedAt?: unknown;
};

type TimestampLike = {
  toDate?: () => Date;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function formatDate(ts: unknown) {
  try {
    if (!ts) return "—";
    const d =
      typeof ts === "object" && ts !== null && "toDate" in ts && typeof (ts as TimestampLike).toDate === "function"
        ? (ts as TimestampLike).toDate!()
        : new Date(ts);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function cleanTitle(raw?: string) {
  const titleRaw = String(raw ?? "").trim();
  if (!titleRaw) return { title: "Simulado", subtitle: "" };

  // Preferimos remover Todos/Todas do que vem depois do "•"
  const parts = titleRaw
    .split("•")
    .map((p) => p.trim())
    .filter(Boolean);

  const main = parts[0] || "Simulado";
  const rest = parts
    .slice(1)
    .filter((p) => {
      const t = p.toLowerCase();
      return t !== "todos" && t !== "todas";
    });

  return {
    title: main,
    subtitle: rest.join(" • "),
  };
}

export default function SimuladosPageClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [err, setErr] = useState("");

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
      const qy = query(ref, orderBy("updatedAt", "desc"));
      const snap = await getDocs(qy);

      const list: SessionDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<SessionDoc, "id">),
      }));

      setSessions(list);
    } catch (error: unknown) {
      console.error(error);
      setErr(getErrorMessage(error, "Falha ao carregar simulados."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const inProgressCount = useMemo(() => {
    return sessions.filter((s) => (s.status || "") === "in_progress").length;
  }, [sessions]);

  async function onDelete(sessionId: string) {
    const u = auth.currentUser;
    if (!u) return;

    const ok = window.confirm("Excluir este simulado? Isso não pode ser desfeito.");
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "users", u.uid, "sessions", sessionId));
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (e) {
      console.error(e);
      alert("Não foi possível excluir. Verifique permissões/regras.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500">Meus</div>
            <div className="text-2xl font-black text-slate-900">Simulados</div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                {inProgressCount} em andamento
              </span>
              <span className="text-xs text-slate-500">
                Atualize recarregando a página.
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push("/aluno/simulados/novo")}>
              Novo simulado
            </Button>
            <Button variant="secondary" onClick={load} disabled={loading}>
              {loading ? "Atualizando…" : "Atualizar"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Estado */}
      {err ? (
        <Card>
          <CardBody>
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {err}
            </div>
            <div className="mt-3">
              <Button onClick={load}>Tentar novamente</Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {loading && !sessions.length ? (
        <Card>
          <CardBody>
            <div className="text-slate-600">Carregando…</div>
          </CardBody>
        </Card>
      ) : null}

      {!loading && !sessions.length && !err ? (
        <Card>
          <CardBody>
            <div className="text-slate-700 font-semibold">
              Você ainda não criou nenhum simulado.
            </div>
            <div className="mt-3">
              <Button onClick={() => router.push("/aluno/simulados/novo")}>
                Criar primeiro simulado
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Lista */}
      <div className="grid gap-3">
        {sessions.map((s) => {
          // ✅ melhor título (se existir)
          const display =
            String(s.titleDisplay ?? "").trim() ||
            String(s.title ?? "").trim();

          const { title, subtitle } = cleanTitle(display);

          const total = Number(s.totalQuestions ?? 0) || 0;
          const answeredRaw = Number(s.answeredCount ?? 0) || 0;
          const answered = total > 0 ? Math.min(answeredRaw, total) : answeredRaw;
          const correct = Number(s.correctCount ?? 0) || 0;

          const percent =
            Number.isFinite(s.scorePercent) && s.scorePercent != null
              ? Number(s.scorePercent)
              : total > 0
              ? Math.round((correct / total) * 100)
              : 0;

          const status = s.status || "in_progress";
          const isCompleted = status === "completed";

          const progressPct =
            total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0;

          return (
            <Card key={s.id}>
              {/* ✅ padding maior no mobile + alinhamento pra não “encostar” na borda */}
              <CardBody className="p-6 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left */}
                  <div className="min-w-0 w-full">
                    {/* ✅ titulo + badge com “respiro” */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 truncate">
                          {title}
                        </div>
                        {subtitle ? (
                          <div className="text-xs text-slate-500 truncate mt-1">
                            {subtitle}
                          </div>
                        ) : null}
                      </div>

                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-bold px-3 py-1 rounded-full border",
                          isCompleted
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        )}
                      >
                        {isCompleted ? "Concluído" : "Em andamento"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border bg-white px-3 py-1 text-slate-700">
                        Atualizado: <b>{formatDate(s.updatedAt)}</b>
                      </span>
                      <span className="rounded-full border bg-white px-3 py-1 text-slate-700">
                        Progresso: <b>{answered}/{total || "—"}</b>
                      </span>
                      <span className="rounded-full border bg-white px-3 py-1 text-slate-700">
                        Acertos: <b>{correct}</b>
                      </span>
                      <span className="rounded-full border bg-white px-3 py-1 text-slate-700">
                        Nota: <b>{percent}%</b>
                      </span>
                    </div>

                    <div className="mt-4 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-900 transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                    {!isCompleted ? (
                      <Button className="w-full sm:w-auto" onClick={() => router.push(`/aluno/simulados/${s.id}`)}>
                        Retomar
                      </Button>
                    ) : (
                      <Button className="w-full sm:w-auto" onClick={() => router.push(`/aluno/simulados/${s.id}/resultado`)}>
                        Resultado
                      </Button>
                    )}

                    <Button className="w-full sm:w-auto" variant="secondary" onClick={() => onDelete(s.id)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="text-xs text-slate-400">
        Se algum botão não abrir, acesse:{" "}
        <Link className="underline" href="/aluno/simulados/novo">
          /aluno/simulados/novo
        </Link>
      </div>
    </div>
  );
}
