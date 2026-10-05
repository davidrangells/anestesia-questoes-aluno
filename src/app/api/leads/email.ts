const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.anestesiaquestoes.com.br";
const LOGO_URL = `${APP_URL}/logo-icon.png`;
const CHECKOUT_URL = "https://chk.eduzz.com/1717250?utm_source=email&utm_medium=lead&utm_campaign=simulado-gratis";
const WHATSAPP_URL =
  "https://wa.me/5515991008159?text=Ol%C3%A1%21%20Fiz%20o%20simulado%20gratuito%20e%20quero%20saber%20mais%20sobre%20a%20plataforma.";

export type LeadResultado = {
  acertos?: number;
  total?: number;
  porTema?: Record<string, { acertos: number; total: number }>;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildLeadResultEmailHtml(nome: string, resultado: LeadResultado): string {
  const primeiroNome = esc((nome || "").trim().split(/\s+/)[0] || "Doutor(a)");
  const acertos = resultado.acertos ?? 0;
  const total = resultado.total ?? 0;
  const pct = total > 0 ? Math.round((acertos / total) * 100) : 0;
  const pctColor = pct >= 60 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626";
  const titulo =
    pct >= 80 ? "Excelente nível!" : pct >= 60 ? "Bom caminho — dá para subir" : pct >= 40 ? "Há lacunas importantes" : "Sinal de alerta";

  const temas = Object.entries(resultado.porTema ?? {});
  const fracos = temas.filter(([, v]) => v.acertos < v.total).map(([t]) => t);

  const linhasTemas = temas
    .map(([tema, v]) => {
      const ok = v.acertos >= v.total;
      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eef1f6;font-size:14px;color:#334155;">${esc(tema)}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #eef1f6;font-size:14px;font-weight:700;color:${ok ? "#16a34a" : "#dc2626"};white-space:nowrap;">${v.acertos}/${v.total}</td>
      </tr>`;
    })
    .join("");

  const blocoFracos = fracos.length
    ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 18px;margin:24px 0 0;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#9a3412;"><strong>Onde focar primeiro:</strong> ${esc(fracos.join(", "))}. No banco completo você filtra centenas de questões só desses temas e revisa com comentários até dominar.</p>
      </div>`
    : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px 18px;margin:24px 0 0;">
        <p style="margin:0;font-size:14px;line-height:1.6;color:#166534;"><strong>Mandou bem em todos os temas da amostra.</strong> Agora imagine esse treino com 4.200+ questões, simulados cronometrados e análise por tema.</p>
      </div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu resultado no simulado gratuito</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 50%,#2563eb 100%);border-radius:20px 20px 0 0;padding:36px 32px 32px;">
              <img src="${LOGO_URL}" alt="Anestesia Questões" width="64" height="64" style="display:block;margin:0 auto 16px;border-radius:16px;" />
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(147,197,253,0.9);">Anestesia Questões</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#0f172a;line-height:1.3;">Seu resultado, ${primeiroNome}</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#475569;">Obrigado por fazer o simulado gratuito. Aqui está o seu diagnóstico:</p>

              <!-- Score -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;">
                <tr>
                  <td align="center" style="padding:26px 20px;">
                    <p style="margin:0;font-size:44px;font-weight:800;line-height:1;color:${pctColor};">${pct}%</p>
                    <p style="margin:8px 0 0;font-size:16px;font-weight:700;color:#0f172a;">${titulo}</p>
                    <p style="margin:4px 0 0;font-size:13px;color:#64748b;">Você acertou ${acertos} de ${total} questões.</p>
                  </td>
                </tr>
              </table>

              <!-- Por tema -->
              ${
                linhasTemas
                  ? `<p style="margin:28px 0 6px;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#64748b;">Desempenho por tema</p>
                     <table width="100%" cellpadding="0" cellspacing="0">${linhasTemas}</table>`
                  : ""
              }

              ${blocoFracos}

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${CHECKOUT_URL}" target="_blank" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:15px 30px;border-radius:12px;">Destravar as 4.200+ questões →</a>
                    <p style="margin:12px 0 0;font-size:13px;color:#64748b;">12× de <strong style="color:#0f172a;">R$ 87,33</strong> sem juros · 12 meses de acesso · 7 dias de garantia</p>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;font-size:14px;line-height:1.65;color:#475569;">Ficou com alguma dúvida? É só responder este e-mail ou <a href="${WHATSAPP_URL}" style="color:#1d4ed8;font-weight:600;">chamar a gente no WhatsApp</a>.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background:#f8fafc;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 20px 20px;padding:24px 32px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">Você recebeu este e-mail porque se cadastrou no simulado gratuito do Anestesia Questões.<br/>Não quer mais receber? Responda com "remover" e excluímos seus dados.<br/>© 2026 Anestesia Questões · CNPJ 45.177.293/0001-15</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
