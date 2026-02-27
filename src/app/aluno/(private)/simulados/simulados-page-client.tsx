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

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type SessionDoc = {
  id: string;
  title?: string;
  status?: "in_progress" | "completed" | string;
  totalQuestions?: number;
  answeredCount?: number;
  correctCount?: number;
  scorePercent?: number;
  updatedAt?: any;

  // caso tenha attemptId (alguns docs antigos)
  attemptId?: string;
};

function formatDate(ts: any) {
  try {
    if (!ts) return "—";
    const d = ts?.toDate?.() ? ts.toDate() : new Date(ts);
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

function normalizeTitle(raw?: string) {
  const titleRaw = (raw ?? "").trim();
  if (!titleRaw) return { title: "Simulado", subtitle: "" };

  // separa "Simulado • TSA • Todos..." -> title = "Simulado", subtitle = resto
  const parts = titleRaw.split("•").map((p) => p.trim()).filter(Boolean);
  const title = parts[0] || "Simulado";
  const subtitle = parts.slice(1).join(" • ");
  return { title, subtitle };
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
        ...(d.data() as any),
      }));

      setSessions(list);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Falha ao carregar simulados.");
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
      {/* Header compacto */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-500">Meus</div>
            <div className="text-2xl font-black text-slate-900">Simulados</div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge>
                {inProgressCount} em andamento
              </Badge>
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

      {/* Lista compacta */}
      <div className="grid gap-3">
        {sessions.map((s) => {
          const { title, subtitle } = normalizeTitle(s.title);

          const total = Number(s.totalQuestions ?? 0) || 0;
          const answered = Number(s.answeredCount ?? 0) || 0;
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
              <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Left info */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-black text-slate-900 truncate max-w-[100%]">
                      {title}
                    </div>
                    {status ? (
                      <span
                        className={cn(
                          "text-[11px] font-bold px-2 py-1 rounded-full border",
                          isCompleted
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                        )}
                      >
                        {isCompleted ? "Concluído" : "Em andamento"}
                      </span>
                    ) : null}
                  </div>

                  {subtitle ? (
                    <div className="text-xs text-slate-500 truncate mt-1">
                      {subtitle}
                    </div>
                  ) : null}

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border bg-white px-2 py-1 text-slate-700">
                      Atualizado: <b>{formatDate(s.updatedAt)}</b>
                    </span>
                    <span className="rounded-full border bg-white px-2 py-1 text-slate-700">
                      Progresso: <b>{answered}/{total || "—"}</b>
                    </span>
                    <span className="rounded-full border bg-white px-2 py-1 text-slate-700">
                      Acertos: <b>{correct}</b>
                    </span>
                    <span className="rounded-full border bg-white px-2 py-1 text-slate-700">
                      Nota: <b>{percent}%</b>
                    </span>
                  </div>

                  {/* barra de progresso compacta */}
                  <div className="mt-3 h-2 w-full max-w-[520px] rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-900 transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {!isCompleted ? (
                    <Button
                      onClick={() => router.push(`/aluno/simulados/${s.id}`)}
                    >
                      Retomar
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        router.push(`/aluno/simulados/${s.id}/resultado`)
                      }
                    >
                      Resultado
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    onClick={() => onDelete(s.id)}
                  >
                    Excluir
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Link fallback (caso precise) */}
      <div className="text-xs text-slate-400">
        Se algum botão não abrir, acesse:{" "}
        <Link className="underline" href="/aluno/simulados/novo">
          /aluno/simulados/novo
        </Link>
      </div>
    </div>
  );
}