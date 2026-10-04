export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

const ALLOWED_ORIGINS = new Set([
  "https://anestesiaquestoes.com.br",
  "https://www.anestesiaquestoes.com.br",
  "http://localhost:8090",
]);

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://anestesiaquestoes.com.br",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

type LeadBody = {
  leadId?: string;
  nome?: string;
  email?: string;
  whatsapp?: string;
  consent?: boolean;
  origem?: string;
  utm?: Record<string, string>;
  resultado?: {
    acertos?: number;
    total?: number;
    porTema?: Record<string, { acertos: number; total: number }>;
  };
  // honeypot: humanos não preenchem
  site?: string;
};

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);
  let body: LeadBody;
  try {
    body = (await req.json()) as LeadBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400, headers });
  }

  // Bot caiu no honeypot: responde ok sem gravar
  if (body.site) {
    return NextResponse.json({ ok: true, id: "ok" }, { status: 200, headers });
  }

  try {
    // Atualização de resultado de um lead existente
    if (body.leadId) {
      if (!body.resultado || typeof body.resultado.total !== "number") {
        return NextResponse.json({ error: "Resultado ausente." }, { status: 400, headers });
      }
      await adminDb.collection("leads").doc(body.leadId).set(
        { resultado: body.resultado, resultadoEm: FieldValue.serverTimestamp() },
        { merge: true }
      );
      return NextResponse.json({ ok: true, id: body.leadId }, { status: 200, headers });
    }

    // Novo lead
    const nome = (body.nome ?? "").trim().slice(0, 120);
    const email = (body.email ?? "").trim().toLowerCase().slice(0, 160);
    const whatsapp = (body.whatsapp ?? "").replace(/\D/g, "").slice(0, 15);
    if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || whatsapp.length < 10 || body.consent !== true) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
    }

    const doc = await adminDb.collection("leads").add({
      nome,
      email,
      whatsapp,
      consent: true,
      origem: (body.origem ?? "simulado-gratis").slice(0, 60),
      utm: body.utm ?? {},
      criadoEm: FieldValue.serverTimestamp(),
      userAgent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    });
    return NextResponse.json({ ok: true, id: doc.id }, { status: 200, headers });
  } catch (err) {
    console.error("[leads] erro:", err);
    return NextResponse.json({ error: "Erro interno." }, { status: 500, headers });
  }
}
