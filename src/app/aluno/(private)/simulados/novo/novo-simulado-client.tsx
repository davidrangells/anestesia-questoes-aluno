"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  orderBy,
  limit,
  QueryConstraint,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function toggle(list: string[], value: string) {
  const arr = Array.isArray(list) ? list : [];
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

type Prova = {
  id: string;
  nome?: string;
  sigla?: string;
  ativo?: boolean;
  ordem?: number;
};

function buildSimuladoTitle({
  provasLabel,
  niveisLabel,
  temasLabel,
}: {
  provasLabel: string;
  niveisLabel: string;
  temasLabel: string;
}) {
  const parts = ["Simulado"];

  const norm = (s: string) => s.trim().toLowerCase();
  const ignore = new Set(["todos", "todas", "todo", "toda", "todas as provas"]);

  const addIfValid = (v: string) => {
    const vv = v.trim();
    if (!vv) return;
    if (ignore.has(norm(vv))) return;
    parts.push(vv);
  };

  addIfValid(provasLabel);
  addIfValid(niveisLabel);
  addIfValid(temasLabel);

  const uniq: string[] = [];
  for (const p of parts) {
    if (!uniq.some((u) => u.toLowerCase() === p.toLowerCase())) uniq.push(p);
  }

  return uniq.join(" • ");
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function asArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

// tenta ler campo em vários nomes possíveis
function readAnyStringArray(d: any, keys: string[]) {
  for (const k of keys) {
    const v = d?.[k];
    const arr = asArray(v);
    if (arr.length) return arr;
  }
  return [];
}

function readAnyString(d: any, keys: string[]) {
  for (const k of keys) {
    const v = d?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export default function NovoSimuladoClient() {
  const router = useRouter();
  const user = auth.currentUser;

  const [provas, setProvas] = useState<Prova[]>([]);
  const [temas, setTemas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedProvas, setSelectedProvas] = useState<string[]>([]);
  const [selectedNiveis, setSelectedNiveis] = useState<string[]>([]);
  const [selectedTemas, setSelectedTemas] = useState<string[]>([]);
  const [qtd, setQtd] = useState<number>(10);

  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const pQ = query(
          collection(db, "provas"),
          where("ativo", "==", true),
          orderBy("ordem", "asc")
        );
        const pSnap = await getDocs(pQ);
        setProvas(pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

        const tSnap = await getDocs(query(collection(db, "temas"), limit(200)));
        const names = tSnap.docs
          .map((d) => (d.data() as any)?.nome)
          .filter(Boolean)
          .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
        setTemas(names);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  const labels = useMemo(() => {
    const provasLabel =
      selectedProvas.length === 0
        ? ""
        : selectedProvas
            .map((id) => {
              const p = provas.find((x) => x.id === id);
              return p?.sigla || p?.nome || id;
            })
            .filter(Boolean)
            .join(", ");

    const niveisLabel =
      selectedNiveis.length === 0 ? "" : selectedNiveis.join(", ");

    const temasLabel = selectedTemas.length === 0 ? "" : selectedTemas.join(", ");

    return { provasLabel, niveisLabel, temasLabel };
  }, [selectedProvas, selectedNiveis, selectedTemas, provas]);

  const title = useMemo(() => buildSimuladoTitle(labels), [labels]);

  /**
   * ✅ Busca IDs de questões conforme filtros.
   *
   * Estratégia:
   * 1) tenta uma query “boa” com where() (se seus campos existirem)
   * 2) se falhar (índice/campo), faz fallback: pega lote e filtra no client
   */
  async function fetchQuestionIds(): Promise<string[]> {
    // ajuste o nome da coleção se necessário:
    const QUESTIONS_COL = "questoes";

    // limites para não estourar no fallback
    const FALLBACK_FETCH_LIMIT = 1500;

    // 1) tentativa de query (se sua modelagem suportar)
    try {
      const constraints: QueryConstraint[] = [];

      // prova: tenta provaId IN
      if (selectedProvas.length > 0 && selectedProvas.length <= 10) {
        constraints.push(where("provaId", "in", selectedProvas));
      }

      // nível: tenta nivel IN
      if (selectedNiveis.length > 0 && selectedNiveis.length <= 10) {
        constraints.push(where("nivel", "in", selectedNiveis));
      }

      // temas: tenta array-contains-any
      if (selectedTemas.length > 0 && selectedTemas.length <= 10) {
        constraints.push(where("temas", "array-contains-any", selectedTemas));
      }

      // se não tem constraints, não faz query “vazia” aqui (vai pro fallback)
      if (constraints.length > 0) {
        const qy = query(collection(db, QUESTIONS_COL), ...constraints, limit(FALLBACK_FETCH_LIMIT));
        const snap = await getDocs(qy);
        const ids = snap.docs.map((d) => d.id).filter(Boolean);

        if (ids.length > 0) return ids;
        // se deu 0, ainda pode ser porque seus campos não batem — tenta fallback
      }
    } catch (e) {
      // ignora e cai pro fallback
      console.warn("Query direta falhou, usando fallback de filtro client-side.", e);
    }

    // 2) fallback seguro: carrega lote e filtra por campos “possíveis”
    const snap = await getDocs(query(collection(db, QUESTIONS_COL), limit(FALLBACK_FETCH_LIMIT)));

    const out: string[] = [];

    snap.forEach((docSnap) => {
      const d = docSnap.data() as any;

      // tenta entender como sua questão guarda prova/nivel/tema
      const provaCandidates = [
        readAnyString(d, ["provaId", "prova", "prova_id"]),
        ...readAnyStringArray(d, ["provas", "provasIds", "provas_ids", "provaIds"]),
      ].filter(Boolean);

      const nivelCandidates = [
        readAnyString(d, ["nivel", "especializacao", "nivelId", "nivel_id"]),
        ...readAnyStringArray(d, ["niveis", "especializacoes"]),
      ].filter(Boolean);

      const temaCandidates = [
        readAnyString(d, ["tema", "temaId", "tema_id"]),
        ...readAnyStringArray(d, ["temas", "temasIds", "temas_ids", "temaIds"]),
      ].filter(Boolean);

      const matchProva =
        selectedProvas.length === 0 ||
        provaCandidates.some((p) => selectedProvas.includes(p));

      const matchNivel =
        selectedNiveis.length === 0 ||
        nivelCandidates.some((n) => selectedNiveis.includes(n));

      const matchTema =
        selectedTemas.length === 0 ||
        temaCandidates.some((t) => selectedTemas.includes(t));

      if (matchProva && matchNivel && matchTema) out.push(docSnap.id);
    });

    return out;
  }

  const createSimulado = async () => {
    if (!user) return;

    setErr("");
    setCreating(true);

    try {
      const pool = await fetchQuestionIds();

      if (!pool.length) {
        setErr("Nenhuma questão encontrada para os filtros selecionados.");
        return;
      }

      // embaralha e pega qtd
      const picked = shuffle(pool).slice(0, qtd);

      if (!picked.length) {
        setErr("Não foi possível gerar o simulado. Tente novamente.");
        return;
      }

      const sessionRef = await addDoc(collection(db, "users", user.uid, "sessions"), {
        title,
        status: "in_progress",
        filters: {
          provas: selectedProvas,
          niveis: selectedNiveis,
          temas: selectedTemas,
        },
        totalQuestions: picked.length,
        answeredCount: 0,
        correctCount: 0,
        wrongCount: 0,
        questionIds: picked, // ✅ agora vai preenchido
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      router.push(`/aluno/simulados/${sessionRef.id}`);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Falha ao criar simulado.");
    } finally {
      setCreating(false);
    }
  };

  const Chip = ({
    active,
    children,
    onClick,
    title,
  }: {
    active?: boolean;
    children: React.ReactNode;
    onClick?: () => void;
    title?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "max-w-full truncate px-4 py-2 rounded-full text-sm font-semibold border transition",
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white text-slate-800 border-slate-200 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );

  const QtyButton = ({ n }: { n: number }) => {
    const active = qtd === n;
    return (
      <Button
        type="button"
        variant={active ? "primary" : "secondary"}
        onClick={() => setQtd(n)}
        className="w-full justify-center"
      >
        {n} questões
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="text-2xl font-black text-slate-900">Novo simulado</div>
          <div className="text-sm text-slate-500 mt-1">
            Selecione seus filtros e gere um simulado personalizado.
          </div>
        </CardHeader>
      </Card>

      {err ? (
        <Card>
          <CardBody>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 font-semibold">
              {err}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <CardBody className="text-sm text-slate-500">Carregando…</CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Provas */}
            <Card>
              <CardHeader>
                <div className="font-black text-slate-900">Seleção de provas</div>
                <div className="text-xs text-slate-500 mt-1">Sem filtro = todas</div>
              </CardHeader>

              <CardBody>
                <div className="flex flex-wrap gap-2">
                  {provas.map((p) => {
                    const active = selectedProvas.includes(p.id);
                    const label = p.sigla || p.nome || p.id;
                    return (
                      <Chip
                        key={p.id}
                        active={active}
                        onClick={() => setSelectedProvas((prev) => toggle(prev, p.id))}
                        title={label}
                      >
                        {label}
                      </Chip>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Níveis */}
            <Card>
              <CardHeader>
                <div className="font-black text-slate-900">Seleção de Especialização</div>
                <div className="text-xs text-slate-500 mt-1">Sem filtro = todos</div>
              </CardHeader>

              <CardBody>
                <div className="flex flex-wrap gap-2">
                  {["R1", "R2", "R3"].map((n) => {
                    const active = selectedNiveis.includes(n);
                    return (
                      <Chip
                        key={n}
                        active={active}
                        onClick={() => setSelectedNiveis((prev) => toggle(prev, n))}
                      >
                        {n}
                      </Chip>
                    );
                  })}
                </div>
              </CardBody>
            </Card>

            {/* Quantidade */}
            <Card>
              <CardHeader>
                <div className="font-black text-slate-900">Quantidade de questões</div>
                <div className="text-xs text-slate-500 mt-1">Escolha quantas questões gerar</div>
              </CardHeader>

              <CardBody>
                <div className="grid grid-cols-2 gap-2">
                  {[10, 20, 30, 50].map((n) => (
                    <QtyButton key={n} n={n} />
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Temas */}
          <Card>
            <CardHeader className="flex items-start justify-between gap-4">
              <div>
                <div className="font-black text-slate-900">Seleção de Temas</div>
                <div className="text-sm text-slate-500 mt-1">
                  Dica: escolha 1–3 temas para ficar mais direcionado.
                </div>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedTemas([])}
              >
                Limpar
              </Button>
            </CardHeader>

            <CardBody>
              <div className="flex flex-wrap gap-2">
                {temas.map((t) => {
                  const active = selectedTemas.includes(t);
                  return (
                    <Chip
                      key={t}
                      active={active}
                      onClick={() => setSelectedTemas((prev) => toggle(prev, t))}
                      title={t}
                    >
                      {t}
                    </Chip>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => router.push("/aluno/simulados")}
                  disabled={creating}
                >
                  Voltar
                </Button>

                <Button type="button" onClick={createSimulado} disabled={creating}>
                  {creating ? "Criando…" : "Criar simulado"}
                </Button>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Título:</span>{" "}
                <span className="break-words">{title}</span>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}