"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

function mapErroToMessage(code: string) {
  switch (code) {
    case "sem_acesso":
      return "Seu acesso ainda não está ativo. Se você já pagou, aguarde alguns minutos ou fale com o suporte.";
    case "verificacao":
      return "Não foi possível verificar seu acesso. Tente novamente em instantes.";
    default:
      return "";
  }
}

function friendlyAuthError(code?: string) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha inválidos.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
    case "auth/network-request-failed":
      return "Falha de rede. Verifique sua conexão e tente novamente.";
    default:
      return "Não foi possível fazer login. Tente novamente.";
  }
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const erro = searchParams.get("erro") || "";
  const erroMsg = useMemo(() => mapErroToMessage(erro), [erro]);

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const [uiError, setUiError] = useState<string>("");
  const [uiInfo, setUiInfo] = useState<string>("");

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setUiError("");
    setUiInfo("");

    const eMail = email.trim().toLowerCase();
    const pwd = senha.trim();
    if (!eMail || !pwd) {
      setUiError("Preencha e-mail e senha.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, eMail, pwd);
      router.replace("/aluno");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setUiError(friendlyAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async () => {
    setUiError("");
    setUiInfo("");

    const eMail = email.trim().toLowerCase();
    if (!eMail) {
      setUiError("Digite seu e-mail acima para enviar o link de redefinição.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, eMail);
      setUiInfo("Te enviei um e-mail com o link para redefinir sua senha.");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setUiError(friendlyAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    setUiError("");
    setUiInfo("");
    setLoading(true);
    try {
      await signOut(auth);
      router.replace("/aluno/entrar");
    } finally {
      setLoading(false);
    }
  };

  const showNoAccessActions = erro === "sem_acesso";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-3xl border bg-white shadow-sm">
        <div className="p-6 border-b">
          <div className="text-xl font-black text-slate-900">Anestesia Questões</div>
          <div className="text-sm text-slate-500">Área do Aluno</div>
        </div>

        <form onSubmit={onLogin} className="p-6 space-y-4">
          {erroMsg ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {erroMsg}
            </div>
          ) : null}

          {uiError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {uiError}
            </div>
          ) : null}

          {uiInfo ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {uiInfo}
            </div>
          ) : null}

          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">E-mail</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              placeholder="seuemail@..."
              className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1">Senha</div>
            <input
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onForgotPassword}
              disabled={loading}
              className="text-xs font-semibold text-slate-700 hover:underline disabled:opacity-60"
            >
              Esqueci minha senha
            </button>

            {showNoAccessActions ? (
              <button
                type="button"
                onClick={onLogout}
                disabled={loading}
                className="text-xs font-semibold text-slate-700 hover:underline disabled:opacity-60"
              >
                Sair / Trocar conta
              </button>
            ) : null}
          </div>

          <div className="text-xs text-slate-500">
            Dica: se você recebeu o e-mail “Crie sua senha”, você também pode usar “Esqueci minha senha”.
          </div>
        </form>
      </div>
    </div>
  );
}