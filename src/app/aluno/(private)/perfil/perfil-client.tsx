"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";

function cn(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

type ProfileData = {
  name?: string;
  phone?: string;

  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;

  // metadados
  updatedAt?: unknown;
  createdAt?: unknown;

  // opcional: origem
  source?: "eduzz" | "user";
  eduzzCustomerId?: string;
};

function initials(nameOrEmail: string) {
  const s = (nameOrEmail || "").trim();
  if (!s) return "AQ";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  half,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  half?: boolean;
}) {
  return (
    <div className={cn(half ? "sm:col-span-6" : "sm:col-span-12")}>
      <label className="block text-sm font-semibold text-slate-800">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="ui-input mt-2"
      />
    </div>
  );
}

export default function PerfilClient() {
  const router = useRouter();
  const user = auth.currentUser;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [email, setEmail] = useState(user?.email || "");
  const [data, setData] = useState<ProfileData>({});

  // form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [addressNeighborhood, setAddressNeighborhood] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [addressZip, setAddressZip] = useState("");

  const displayName = useMemo(() => {
    return (name || data.name || email || "Seu perfil").trim();
  }, [name, data.name, email]);

  const load = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) {
      router.replace("/aluno/entrar");
      return;
    }

    setLoading(true);
    try {
      setEmail(u.email || "");

      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      const d = (snap.exists() ? (snap.data() as ProfileData) : {}) || {};
      setData(d);

      setName(d.name || "");
      setPhone(d.phone || "");

      setAddressStreet(d.addressStreet || "");
      setAddressNumber(d.addressNumber || "");
      setAddressComplement(d.addressComplement || "");
      setAddressNeighborhood(d.addressNeighborhood || "");
      setAddressCity(d.addressCity || "");
      setAddressState(d.addressState || "");
      setAddressZip(d.addressZip || "");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit() {
    setEditing(true);
  }

  function cancelEdit() {
    // volta pro que está no Firestore (data)
    setName(data.name || "");
    setPhone(data.phone || "");

    setAddressStreet(data.addressStreet || "");
    setAddressNumber(data.addressNumber || "");
    setAddressComplement(data.addressComplement || "");
    setAddressNeighborhood(data.addressNeighborhood || "");
    setAddressCity(data.addressCity || "");
    setAddressState(data.addressState || "");
    setAddressZip(data.addressZip || "");

    setEditing(false);
  }

  async function onSave() {
    const u = auth.currentUser;
    if (!u) return;

    setSaving(true);
    try {
      const ref = doc(db, "users", u.uid);

      const payload: ProfileData = {
        name: name.trim(),
        phone: phone.trim(),

        addressStreet: addressStreet.trim(),
        addressNumber: addressNumber.trim(),
        addressComplement: addressComplement.trim(),
        addressNeighborhood: addressNeighborhood.trim(),
        addressCity: addressCity.trim(),
        addressState: addressState.trim(),
        addressZip: addressZip.trim(),

        updatedAt: serverTimestamp(),
        // se não existir, cria também:
        createdAt: data.createdAt ? data.createdAt : serverTimestamp(),

        source: "user",
      };

      // ✅ setDoc com merge evita "No document to update"
      await setDoc(ref, payload, { merge: true });

      setData((prev) => ({ ...prev, ...payload }));
      setEditing(false);
      alert("Perfil atualizado!");
    } catch (error: unknown) {
      console.error(error);
      const message = error instanceof Error && error.message ? error.message : "Erro ao salvar perfil.";
      alert(message);
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    const u = auth.currentUser;
    const userEmail = u?.email || "";
    if (!userEmail) {
      alert("Seu usuário não tem e-mail.");
      return;
    }
    await sendPasswordResetEmail(auth, userEmail);
    alert("Enviei um link de redefinição para o seu e-mail.");
  }

  async function logout() {
    await auth.signOut();
    router.replace("/aluno/entrar");
  }

  if (loading) {
    return (
      <div className="rounded-3xl border bg-white shadow-sm p-6 text-slate-600">
        Carregando perfil…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border bg-white shadow-sm px-6 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Área do Aluno</div>
            <div className="text-2xl font-black text-slate-900">Perfil</div>
            <div className="text-sm text-slate-600 mt-1">
              Gerencie suas informações e acesso.
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" onClick={resetPassword}>
              Redefinir senha
            </Button>
            <Button onClick={logout}>
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card: dados */}
        <div className="lg:col-span-2 rounded-3xl border bg-white shadow-sm p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-14 w-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black">
                {initials(displayName || email)}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-black text-slate-900 truncate">{displayName}</div>
                <div className="text-sm text-slate-600 truncate">{email}</div>
              </div>
            </div>

            {!editing ? (
              <Button variant="secondary" onClick={startEdit} className="w-full sm:w-auto">
                Editar informações
              </Button>
            ) : (
              <Button variant="secondary" onClick={cancelEdit} className="w-full sm:w-auto">
                Cancelar
              </Button>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-12 gap-4">
            <Field
              label="Nome"
              value={name}
              onChange={setName}
              placeholder="Ex: Dr. João Silva"
              disabled={!editing}
              half
            />
            <Field
              label="Telefone"
              value={phone}
              onChange={setPhone}
              placeholder="Ex: (15) 99999-9999"
              disabled={!editing}
              half
            />

            {/* Endereço */}
            <Field
              label="Rua / Avenida"
              value={addressStreet}
              onChange={setAddressStreet}
              placeholder="Ex: Av. Barão de Tatuí"
              disabled={!editing}
            />
            <Field
              label="Número"
              value={addressNumber}
              onChange={setAddressNumber}
              placeholder="Ex: 123"
              disabled={!editing}
              half
            />
            <Field
              label="Complemento"
              value={addressComplement}
              onChange={setAddressComplement}
              placeholder="Ex: Apto 12 / Bloco B"
              disabled={!editing}
              half
            />
            <Field
              label="Bairro"
              value={addressNeighborhood}
              onChange={setAddressNeighborhood}
              placeholder="Ex: Centro"
              disabled={!editing}
              half
            />
            <Field
              label="Cidade"
              value={addressCity}
              onChange={setAddressCity}
              placeholder="Ex: Sorocaba"
              disabled={!editing}
              half
            />
            <Field
              label="UF"
              value={addressState}
              onChange={setAddressState}
              placeholder="Ex: SP"
              disabled={!editing}
              half
            />
            <Field
              label="CEP"
              value={addressZip}
              onChange={setAddressZip}
              placeholder="Ex: 18000-000"
              disabled={!editing}
              half
            />
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={onSave}
              disabled={!editing || saving}
              className={!editing ? "w-full bg-slate-300 text-slate-700 shadow-none hover:bg-slate-300 sm:w-auto" : "w-full sm:w-auto"}
            >
              {saving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </div>

        {/* Card: segurança */}
        <div className="rounded-3xl border bg-white shadow-sm p-6">
          <div className="text-lg font-black text-slate-900">Segurança</div>

          <div className="mt-4 rounded-2xl border bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-800">E-mail de acesso</div>
            <div className="text-sm text-slate-700 mt-1 break-all">{email}</div>
          </div>

          <div className="mt-4 rounded-2xl border bg-white p-4">
            <div className="text-sm font-semibold text-slate-800">Dica</div>
            <div className="text-sm text-slate-700 mt-2 leading-relaxed">
              Para trocar a senha, use <span className="font-semibold">Redefinir senha</span> —
              você recebe o link no e-mail.
            </div>
          </div>

          <Button variant="secondary" onClick={() => router.push("/aluno")} className="mt-4 w-full">
            Voltar ao Início
          </Button>
        </div>
      </div>
    </div>
  );
}
