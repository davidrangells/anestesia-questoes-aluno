"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

type SessionDoc = {
  id: string;
  title?: string;
  status?: "in_progress" | "finished" | string;
  totalQuestions?: number;
  answeredCount?: number;
  correctCount?: number;
  scorePercent?: number;
  updatedAt?: any;
  createdAt?: any;
  filters?: any;
};

type BankQuestion = {
  id: string;
  active?: boolean;
  examType?: string;
  specialization?: string;
  themes?: string[];
};

const cn = (...classes: (string | false | undefined | null)[]) =>
  classes.filter(Boolean).join(" ");

function safeArr<T>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const examTypeOptions = ["TSA", "TEA", "Residência ME"];
const specializationOptions = ["R1", "R2", "R3"];

export default function SimuladosPageClient() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionDoc[]>([]);
  const [error, setError] = useState("");

  // modal novo simulado
  const [openNew, setOpenNew] = useState(false);
  const [creating, setCreating] = useState(false);

  // filtros
  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [count, setCount] = useState<number>(10);

  const inProgressCount = useMemo(
    () => sessions.filter((s) => s.status === "in_progress").length,
    [sessions]
  );

  function chipSelected(arr: string[], v: string) {
    return arr.includes(v);
  }

  function toggleValue(arr: string[], v: string, setter: (x: string[]) => void) {
    if (arr.includes(v)) setter(arr.filter((x) => x !== v));
    else setter([...arr, v]);
  }

  function formatTitleFromFilters() {
    const ex = examTypes.length ? examTypes.join(", ") : "Todas";
    const sp = specializations.length ? specializations.join(", ") : "Todos";
    const th = themes.length ? themes.join(", ") : "Todos";
    return `Simulado • ${ex} • ${sp} • ${th}`;
  }

  async function loadSessions(uid: string) {
    setLoading(true);
    setError("");

    try {
      // ✅ SEM índice composto: só orderBy (índice padrão do Firestore)
      const col = collection(db, "users", uid, "sessions");
      const qy = query(col, orderBy("updatedAt", "desc"), limit(50));

      const snap = await getDocs(qy);
      const list: SessionDoc[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));

      setSessions(list);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Falha ao carregar seus simulados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // ✅ garante pegar o usuário mesmo se auth.currentUser ainda estiver null no primeiro render
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) {
        setLoading(false);
        setError("Você precisa estar logado.");
        return;
      }
      loadSessions(u.uid);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createSimulado() {
    const u = auth.currentUser;
    if (!u) {
      alert("Você precisa estar logado.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      // 1) Carrega questionsBank (apenas ativas)
      const qb = collection(db, "questionsBank");
      const qbSnap = await getDocs(qb);

      const all: BankQuestion[] = [];
      qbSnap.forEach((d) => {
        const data = d.data() as any;
        all.push({
          id: d.id,
          active: data.active ?? true,
          examType: data.examType,
          specialization: data.specialization,
          themes: safeArr<string>(data.themes),
        });
      });

      const activeOnes = all.filter((q) => q.active !== false);

      // 2) Filtra e sorteia
      const refined = activeOnes.filter((q) => {
        if (examTypes.length && q.examType && !examTypes.includes(q.examType)) return false;
        if (specializations.length && q.specialization && !specializations.includes(q.specialization))
          return false;

        if (themes.length) {
          const qThemes = safeArr<string>(q.themes);
          const ok = themes.some((t) => qThemes.includes(t));
          if (!ok) return false;
        }

        return true;
      });

      const picked = shuffle(refined).slice(0, count);
      const questionIds = picked.map((q) => q.id);

      if (!questionIds.length) {
        alert("Não encontrei questões com esses filtros.");
        return;
      }

      // 3) Criar session
      const title = formatTitleFromFilters();

      const sessionRef = await addDoc(collection(db, "users", u.uid, "sessions"), {
        title,
        status: "in_progress",
        totalQuestions: questionIds.length,
        answeredCount: 0,
        correctCount: 0,
        scorePercent: 0,
        currentIndex: 0,
        questionIds,
        answersMap: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        filters: {
          examTypes,
          specializations,
          themes,
          count,
        },
      });

      setOpenNew(false);
      router.push(`/aluno/simulados/${sessionRef.id}`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Falha ao criar simulado.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header estilo app */}
      <div className="rounded-3xl border bg-white shadow-sm">
        <div className="px-6 py-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-xl font-black text-slate-900">Meus Simulados</div>
            <div className="text-sm text-slate-500">
              Puxe para atualizar (aqui é só recarregar a página 😅)
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-100 text-violet-700 px-3 py-1 text-xs font-bold">
              {inProgressCount} em andamento
            </span>

            <button
              onClick={() => setOpenNew(true)}
              className="rounded-2xl px-4 py-2 bg-slate-900 text-white font-semibold hover:bg-slate-800 transition"
            >
              Novo simulado
            </button>

            <button
              onClick={() => (auth.currentUser ? loadSessions(auth.currentUser.uid) : null)}
              className="rounded-2xl px-4 py-2 border bg-white font-semibold hover:bg-slate-50 transition"
            >
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* erro */}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* lista */}
      <div className="rounded-3xl border bg-white shadow-sm p-6">
        {loading ? (
          <div className="text-slate-500">Carregando…</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10">
            <div className="font-black text-slate-900">Nenhum simulado ainda</div>
            <div className="text-sm text-slate-500 mt-1">Crie o primeiro no botão acima.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((s) => {
              const answered = Number(s.answeredCount ?? 0);
              const total = Number(s.totalQuestions ?? 0);
              const correct = Number(s.correctCount ?? 0);
              const score = Number(s.scorePercent ?? 0);

              return (
                <div key={s.id} className="rounded-3xl border bg-white p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-black text-slate-900 truncate">{s.title}</div>
                      <div className="text-sm text-slate-500 mt-1">
                        Atualizado: {s.updatedAt?.toDate?.()?.toLocaleString?.() || "—"}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full bg-violet-100 text-violet-700 px-3 py-1 text-xs font-bold">
                          Acertos: {correct}
                        </span>
                        <span className="rounded-full bg-violet-100 text-violet-700 px-3 py-1 text-xs font-bold">
                          Nota: {score}%
                        </span>
                        <span className="rounded-full bg-violet-100 text-violet-700 px-3 py-1 text-xs font-bold">
                          Status: {s.status}
                        </span>
                        <span className="rounded-full bg-violet-100 text-violet-700 px-3 py-1 text-xs font-bold">
                          {answered}/{total}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/aluno/simulados/${s.id}`)}
                        className="rounded-2xl px-6 py-3 bg-blue-600 text-white font-semibold hover:bg-blue-500 transition"
                      >
                        Retomar
                      </button>

                      <button
                        onClick={() => alert("Excluir: a gente implementa no próximo passo.")}
                        className="rounded-2xl px-6 py-3 border bg-white font-semibold hover:bg-slate-50 transition"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Novo Simulado */}
      {openNew ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl rounded-3xl bg-white shadow-xl border overflow-hidden">
            <div className="px-6 py-5 border-b flex items-center justify-between">
              <div>
                <div className="text-xl font-black text-slate-900">Novo simulado</div>
                <div className="text-sm text-slate-500">
                  Selecione seus filtros e gere um simulado personalizado.
                </div>
              </div>
              <button
                onClick={() => setOpenNew(false)}
                className="rounded-2xl px-4 py-2 border bg-white font-semibold hover:bg-slate-50 transition"
              >
                Voltar
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Provas */}
              <div className="rounded-3xl border p-5">
                <div className="font-black text-slate-900">Seleção de provas</div>
                <div className="text-sm text-slate-500 mt-1">Sem filtro = todas</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {examTypeOptions.map((v) => {
                    const active = chipSelected(examTypes, v);
                    return (
                      <button
                        key={v}
                        onClick={() => toggleValue(examTypes, v, setExamTypes)}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-semibold border transition",
                          active
                            ? "bg-violet-100 border-violet-200 text-violet-700"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Especialização */}
              <div className="rounded-3xl border p-5">
                <div className="font-black text-slate-900">Seleção de Especialização</div>
                <div className="text-sm text-slate-500 mt-1">Sem filtro = todos</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {specializationOptions.map((v) => {
                    const active = chipSelected(specializations, v);
                    return (
                      <button
                        key={v}
                        onClick={() => toggleValue(specializations, v, setSpecializations)}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-semibold border transition",
                          active
                            ? "bg-violet-100 border-violet-200 text-violet-700"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        {v}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quantidade */}
              <div className="rounded-3xl border p-5">
                <div className="font-black text-slate-900">Quantidade de questões</div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {[10, 20, 30, 50].map((n) => {
                    const active = count === n;
                    return (
                      <button
                        key={n}
                        onClick={() => setCount(n)}
                        className={cn(
                          "rounded-2xl px-4 py-3 text-sm font-semibold border transition",
                          active
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
                        )}
                      >
                        {n} questões
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={createSimulado}
                disabled={creating}
                className="w-full rounded-2xl px-6 py-4 bg-blue-600 text-white font-semibold hover:bg-blue-500 transition disabled:opacity-60"
              >
                {creating ? "Criando…" : "Criar simulado"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}