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
  // ✅ título limpo (não coloca “Todos/Todas” e não repete)
  // ex:
  // "Simulado" (sem filtros)
  // "Simulado • TEA, TSA"
  // "Simulado • TEA • R2"
  // "Simulado • TEA • R2 • Bloqueios Periféricos"
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

  // remove duplicados
  const uniq: string[] = [];
  for (const p of parts) {
    if (!uniq.some((u) => u.toLowerCase() === p.toLowerCase())) uniq.push(p);
  }

  return uniq.join(" • ");
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

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        // Provas ativas ordenadas
        const pQ = query(
          collection(db, "provas"),
          where("ativo", "==", true),
          orderBy("ordem", "asc")
        );
        const pSnap = await getDocs(pQ);
        setProvas(pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

        // Temas
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
        ? "" // ✅ sem “Todas”
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

  const title = useMemo(() => {
    return buildSimuladoTitle(labels);
  }, [labels]);

  const createSimulado = async () => {
    if (!user) return;

    const sessionRef = await addDoc(collection(db, "users", user.uid, "sessions"), {
      title,
      status: "in_progress",
      filters: {
        provas: selectedProvas,
        niveis: selectedNiveis,
        temas: selectedTemas,
      },
      totalQuestions: qtd,
      answeredCount: 0,
      correctCount: 0,
      wrongCount: 0,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      // questionIds: [...]  (vamos preencher no passo do Quiz)
    });

    router.push(`/aluno/simulados/${sessionRef.id}`);
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
  }) => {
    return (
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
  };

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
                >
                  Voltar
                </Button>

                <Button type="button" onClick={createSimulado}>
                  Criar simulado
                </Button>
              </div>

              {/* ✅ agora não mostra “Todos/Todas…” */}
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