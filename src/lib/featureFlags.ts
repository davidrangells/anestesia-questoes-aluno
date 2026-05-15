/**
 * Feature Flags — controla quais features estão visíveis para os usuários.
 *
 * Cada flag é uma variável de ambiente que começa com NEXT_PUBLIC_FF_
 * (precisa ser NEXT_PUBLIC_ para ser acessível no client-side).
 *
 * Como usar:
 *   import { featureFlags } from "@/lib/featureFlags";
 *   if (featureFlags.flashcards) {
 *     // mostra a feature
 *   }
 *
 * Para ativar uma flag:
 *   - Em desenvolvimento (.env.local): NEXT_PUBLIC_FF_FLASHCARDS=true
 *   - No Vercel: Settings → Environment Variables → adicione a variável
 *     e escolha o environment (Production, Preview, Development)
 *
 * Padrão de ativação:
 *   - Adicione a flag em "Preview" (homologação) primeiro
 *   - Teste em homolog.anestesiaquestoes.com.br
 *   - Quando estiver pronto, adicione em "Production" também
 */

function isEnabled(name: string): boolean {
  const value = process.env[name];
  if (!value) return false;
  return value === "true" || value === "1";
}

export const featureFlags = {
  /** Sistema de flashcards (em desenvolvimento) */
  flashcards: isEnabled("NEXT_PUBLIC_FF_FLASHCARDS"),

  /** Indica que estamos em ambiente de homologação (mostra banner amarelo) */
  staging: isEnabled("NEXT_PUBLIC_FF_STAGING"),
} as const;

export type FeatureFlag = keyof typeof featureFlags;
