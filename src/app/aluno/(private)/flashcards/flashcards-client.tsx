"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  BarChart3,
  Flame,
  Layers,
  Lock,
  Sparkles,
  Zap,
} from "lucide-react";
import { fetchOrCreateSettings, fetchPublishedDecks, type DeckListItem } from "@/lib/flashcards/queries";
import { useHasFlashcardsAccess } from "@/lib/flashcards/access";
import { MODULE_LABEL } from "@/lib/flashcards/constants";
import type { UserFlashcardSettingsDoc, Module } from "@/lib/flashcards/types";

export default function FlashcardsClient() {
  const access = useHasFlashcardsAccess();
  const [decks, setDecks] = useState<DeckListItem[]>([]);
  const [settings, setSettings] = useState<UserFlashcardSettingsDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUid(u?.uid ?? null));
  }, []);

  useEffect(() => {
    if (!access.hasAccess || !uid) {
      if (!access.loading) setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [decksData, settingsData] = await Promise.all([
          fetchPublishedDecks(),
          fetchOrCreateSettings(uid),
        ]);
        if (!alive) return;
        setDecks(decksData);
        setSettings(settingsData);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [access.hasAccess, uid, access.loading]);

  // ─── Estados de bloqueio ────────────────────────────────────────────────
  if (access.loading) {
    return <LoadingScreen />;
  }
  if (!access.hasAccess) {
    if (access.reason === "wrong_plan") return <UpgradePlanScreen />;
    if (access.reason === "flag_off") return <ComingSoonScreen />;
    return <UpgradePlanScreen />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Flashcards
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Revisão inteligente com repetição espaçada. Estude cards do dia ou escolha um deck específico.
        </p>
      </div>

      {/* Painel de estatisticas */}
      {settings && (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            icon={Flame}
            label="Streak"
            value={settings.streak}
            suffix="dia(s)"
            tone="orange"
          />
          <StatCard
            icon={Sparkles}
            label="Cards dominados"
            value={settings.totalCardsMastered}
            tone="emerald"
          />
          <StatCard
            icon={BarChart3}
            label="Total de revisões"
            value={settings.totalReviews}
            tone="blue"
          />
        </div>
      )}

      {/* Card destacado: Estudar hoje */}
      <Link
        href="/aluno/flashcards/estudar"
        className="group block overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-8 text-white shadow-lg transition hover:shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-200">
              <Zap size={14} /> Deck do Dia
            </div>
            <h2 className="text-2xl font-black leading-tight">
              Estudar cards de hoje
            </h2>
            <p className="mt-2 text-sm text-blue-100/90">
              Sistema seleciona automaticamente cards vencidos + novos.
              15-20 minutos por dia é o suficiente para dominar o conteúdo.
            </p>
          </div>
          <div className="hidden shrink-0 rounded-2xl bg-white/15 p-4 backdrop-blur sm:block">
            <Sparkles size={32} className="text-yellow-300" />
          </div>
        </div>
        <div className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-blue-700 transition group-hover:bg-blue-50">
          Começar agora →
        </div>
      </Link>

      {/* Decks */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            Decks disponíveis
          </h3>
          <span className="text-xs text-slate-500">
            {loading ? "..." : `${decks.length} decks`}
          </span>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        ) : decks.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <Layers size={40} className="mx-auto mb-3 text-slate-300" />
            <div className="font-semibold text-slate-700 dark:text-slate-300">
              Nenhum deck publicado ainda
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Novos decks aparecerão aqui em breve.
            </div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <Link
                key={deck.id}
                href={`/aluno/flashcards/estudar?deck=${encodeURIComponent(deck.id)}`}
                className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
              >
                <div className="mb-1 flex items-center gap-2">
                  {deck.moduleId && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {MODULE_LABEL[deck.moduleId as Module]}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    {deck.cardCount} card(s)
                  </span>
                </div>
                <div className="font-semibold text-slate-800 group-hover:text-blue-600 dark:text-slate-200 dark:group-hover:text-blue-400">
                  {deck.title}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componentes auxiliares ────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  suffix?: string;
  tone: "orange" | "emerald" | "blue";
}) {
  const colors: Record<string, { bg: string; icon: string }> = {
    orange: {
      bg: "border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/30",
      icon: "text-orange-500",
    },
    emerald: {
      bg: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30",
      icon: "text-emerald-500",
    },
    blue: {
      bg: "border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30",
      icon: "text-blue-500",
    },
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[tone].bg}`}>
      <div className="flex items-center gap-2">
        <Icon size={18} className={colors[tone].icon} />
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-300">
          {label}
        </div>
      </div>
      <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
        {value.toLocaleString("pt-BR")}
        {suffix && <span className="ml-1 text-sm font-normal text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}

function UpgradePlanScreen() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-100 p-10 text-center dark:border-blue-900 dark:from-blue-950/40 dark:to-indigo-950/40">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-md">
        <Lock size={32} className="text-blue-600" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 dark:text-white">
        Recurso exclusivo do plano TSA
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-slate-600 dark:text-slate-300">
        Os flashcards com repetição espaçada estão disponíveis apenas para
        alunos do plano <strong>Cobertura Completa (TSA)</strong>. Faça upgrade
        para desbloquear mais de <strong>2.000 cards</strong> de revisão rápida.
      </p>
      <Link
        href="/aluno/assinatura"
        className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:from-blue-600 hover:to-blue-400"
      >
        Ver planos disponíveis
      </Link>
    </div>
  );
}

function ComingSoonScreen() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30">
        <Sparkles size={32} className="text-amber-500" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 dark:text-white">
        Em breve
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-slate-500 dark:text-slate-400">
        Estamos preparando o novo módulo de flashcards. Volte em alguns dias!
      </p>
    </div>
  );
}
