"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

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
          ? "bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)]"
          : "text-slate-700 hover:bg-slate-100"
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

  const logout = async () => {
    await signOut(auth);
    router.replace("/aluno/entrar");
  };

  const isDrawer = variant === "drawer";

  return (
    <aside
      className={cn(
        "shrink-0 bg-white flex flex-col",
        isDrawer
          ? "w-[85vw] max-w-[320px] h-full"
          : "hidden lg:flex w-[320px] min-h-screen sticky top-0 border-r"
      )}
    >
      {/* Brand */}
      <div className="px-5 py-5 border-b">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black">
            AQ
          </div>
          <div className="min-w-0">
            <div className="text-lg font-black text-slate-900 truncate">
              Anestesia Questões
            </div>
            <div className="text-xs text-slate-500">Área do Aluno</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-4 py-4 flex flex-col gap-2">
        <Item href="/aluno" label="Dashboard" icon="🏠" onNavigate={onNavigate} />
        <Item
          href="/aluno/provas"
          label="Provas"
          icon="📝"
          onNavigate={onNavigate}
        />
        <Item
          href="/aluno/simulados"
          label="Simulados"
          icon="🧠"
          onNavigate={onNavigate}
        />
        <Item
          href="/aluno/ranking"
          label="Ranking"
          icon="🏆"
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

      <div className="mt-auto px-4 py-4 border-t">
        <button
          onClick={logout}
          className="w-full rounded-2xl px-4 py-3 text-sm bg-slate-900 text-white hover:bg-slate-800 transition font-semibold"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}