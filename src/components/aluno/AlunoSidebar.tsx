"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAlunoTheme } from "@/components/aluno/AlunoThemeProvider";

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false;

  // evita /aluno ficar ativo em /aluno/provas, /aluno/simulados, etc.
  if (href === "/aluno") return pathname === "/aluno" || pathname === "/aluno/";

  return pathname === href || pathname.startsWith(href + "/");
}

function Item({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
        active
          ? "bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)] dark:bg-gradient-to-r dark:from-blue-500 dark:to-indigo-500 dark:text-white dark:shadow-[0_20px_45px_rgba(37,99,235,0.35)]"
          : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70"
      )}
    >
      <span
        className={cn(
          "text-base",
          active ? "opacity-100" : "opacity-80 group-hover:opacity-100"
        )}
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default function AlunoSidebar({
  variant = "desktop",
  onNavigate,
}: {
  variant?: "desktop" | "drawer";
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const { theme, setTheme } = useAlunoTheme();
  const [logoError, setLogoError] = useState(false);

  const logout = async () => {
    await signOut(auth);
    onNavigate?.();
    router.replace("/aluno/entrar");
  };

  const isDrawer = variant === "drawer";

  return (
    <aside
      className={cn(
        "shrink-0 bg-white text-slate-900 flex flex-col dark:bg-[#030b21] dark:text-slate-100",
        isDrawer
          ? "h-full w-full"
          : "hidden lg:flex w-[320px] min-h-screen sticky top-0 border-r border-slate-200 dark:border-slate-800/80"
      )}
    >
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl overflow-hidden bg-slate-900 text-white flex items-center justify-center font-black dark:border dark:border-slate-700/80 dark:bg-[#061738] dark:text-blue-300">
            {!logoError ? (
              <Image
                src="/logo.png"
                alt="Logo Anestesia Questões"
                width={48}
                height={48}
                className="h-[78%] w-[78%] object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              "AQ"
            )}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-black text-slate-900 truncate dark:text-slate-100">
              Anestesia Questões
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Área do Aluno</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-4 py-4 flex flex-col gap-2">
        <div className="px-2 text-[11px] font-bold tracking-[0.22em] text-slate-400 dark:text-slate-500">NAVEGAÇÃO</div>
        <Item href="/aluno" label="Início" icon="🏠" onNavigate={onNavigate} />
        <Item
          href="/aluno/simulados"
          label="Simulados"
          icon="🧠"
          onNavigate={onNavigate}
        />
        <Item
          href="/aluno/assinatura"
          label="Assinatura"
          icon="💳"
          onNavigate={onNavigate}
        />
        <Item
          href="/aluno/perfil"
          label="Perfil"
          icon="👤"
          onNavigate={onNavigate}
        />
      </nav>

      <div className="mt-auto space-y-3 border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-800/80 dark:bg-[#030b21]">
        <div className="rounded-2xl border border-slate-200 p-2 dark:border-slate-800/80 dark:bg-[#04102a]">
          <div className="mb-2 px-2 text-[11px] font-bold tracking-[0.22em] text-slate-400 dark:text-slate-500">TEMA</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                theme === "light"
                  ? "border-slate-300 bg-white text-slate-900 shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              Claro
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                theme === "dark"
                  ? "border-blue-400/40 bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-[0_10px_30px_rgba(37,99,235,0.35)]"
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              Escuro
            </button>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full rounded-2xl px-4 py-3 text-sm bg-slate-900 text-white hover:bg-slate-800 transition font-semibold dark:border dark:border-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
