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
  createdAt?: unknown;
  control?: boolean;
  kind?: string;
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
        : ts instanceof Date
        ? ts
        : typeof ts === "string" || typeof ts === "number"
        ? new Date(ts)
        : null;
    if (!d) return "—";
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

function toMillis(ts: unknown) {
  try {
    if (!ts) return 0;
    const d =
      typeof ts === "object" && ts !== null && "toDate" in ts && typeof (ts as TimestampLike).toDate === "function"
        ? (ts as TimestampLike).toDate!()
        : ts instanceof Date
        ? ts
        : typeof ts === "string" || typeof ts === "number"
        ? new Date(ts)
        : null;
    return d ? d.getTime() : 0;
  } catch {
    return 0;
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

  const sessionNumberById = useMemo(() => {
    const map = new Map<string, number>();
    const ordered = [...sessions].sort((a, b) => {
      const aCreated = toMillis(a.createdAt);
      const bCreated = toMillis(b.createdAt);
      if (aCreated !== bCreated) return aCreated - bCreated;
      return toMillis(a.updatedAt) - toMillis(b.updatedAt);
    });
    ordered.forEach((s, index) => {
      map.set(s.id, index + 1);
    });
    return map;
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
    <div className="space-y-4 overflow-x-hidden">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Meus</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100">Simulados</div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {inProgressCount} em andamento
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Atualize recarregando a página.
              </span>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Button className="w-full sm:w-auto" onClick={() => router.push("/aluno/simulados/novo")}>
              Novo simulado
            </Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={load} disabled={loading}>
              {loading ? "Atualizando…" : "Atualizar"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Estado */}
      {err ? (
        <Card>
          <CardBody>
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
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
            <div className="text-slate-600 dark:text-slate-300">Carregando…</div>
          </CardBody>
        </Card>
      ) : null}

      {!loading && !sessions.length && !err ? (
        <Card>
          <CardBody>
            <div className="text-slate-700 font-semibold dark:text-slate-200">
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

          const { subtitle } = cleanTitle(display);
          const number = sessionNumberById.get(s.id) ?? 0;
          const numberedTitle = `Simulado ${String(number || 1).padStart(2, "0")}`;

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
            <Card key={s.id} className="overflow-hidden">
              {/* ✅ padding maior no mobile + alinhamento pra não “encostar” na borda */}
              <CardBody className="p-6 sm:p-6">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left */}
                  <div className="min-w-0 w-full">
                    {/* ✅ titulo + badge com “respiro” */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-black text-slate-900 truncate dark:text-slate-100">
                          {numberedTitle}
                        </div>
                        {subtitle ? (
                          <div className="text-xs text-slate-500 truncate mt-1 dark:text-slate-400">
                            {subtitle}
                          </div>
                        ) : null}
                      </div>

                      <span
                        className={cn(
                          "shrink-0 text-[11px] font-bold px-3 py-1 rounded-full border",
                          isCompleted
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/40"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900/40"
                        )}
                      >
                        {isCompleted ? "Concluído" : "Em andamento"}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="max-w-full truncate rounded-full border bg-white px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        Atualizado: <b>{formatDate(s.updatedAt)}</b>
                      </span>
                      <span className="max-w-full truncate rounded-full border bg-white px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        Progresso: <b>{answered}/{total || "—"}</b>
                      </span>
                      <span className="max-w-full truncate rounded-full border bg-white px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        Acertos: <b>{correct}</b>
                      </span>
                      <span className="max-w-full truncate rounded-full border bg-white px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        Nota: <b>{percent}%</b>
                      </span>
                    </div>

                    <div className="mt-4 h-2 w-full rounded-full bg-slate-100 overflow-hidden dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-slate-900 transition-all dark:bg-slate-200"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                    {!isCompleted ? (
                      <Button className="w-full !justify-center sm:w-auto" onClick={() => router.push(`/aluno/simulados/${s.id}`)}>
                        Retomar
                      </Button>
                    ) : (
                      <Button className="w-full !justify-center sm:w-auto" onClick={() => router.push(`/aluno/simulados/${s.id}/resultado`)}>
                        Resultado
                      </Button>
                    )}

                    <Button className="w-full !justify-center sm:w-auto" variant="secondary" onClick={() => onDelete(s.id)}>
                      Excluir
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="text-xs text-slate-400 dark:text-slate-500">
        Se algum botão não abrir, acesse:{" "}
        <Link className="underline" href="/aluno/simulados/novo">
          /aluno/simulados/novo
        </Link>
      </div>
    </div>
  );
}
