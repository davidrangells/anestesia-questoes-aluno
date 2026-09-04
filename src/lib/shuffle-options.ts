// Embaralhamento das alternativas na tela do aluno.
//
// Precisa ficar idêntico ao do app mobile (estudo-quiz/src/services/shuffle-options.js),
// senão a mesma questão apareceria em ordens diferentes conforme a plataforma.
//
// Por que embaralhar: sem isso, a alternativa correta ocupa sempre a mesma
// posição, e quem repete a questão lembra a posição em vez do conteúdo.
//
// Por que com semente (e não Math.random): a ordem precisa ser estável enquanto
// o aluno responde e quando ele revê o resultado depois. Sorteio puro
// reembaralharia a cada render, com as alternativas pulando na tela. A semente
// vem de (questionId + sessionId): fixa dentro de uma sessão, diferente na
// próxima vez que a questão cair, inclusive para o mesmo aluno.
//
// A correção NÃO depende disto: a resposta é sempre comparada por `option.id`,
// nunca pela posição na tela.

export type ComId = { id: string };

/** Hash FNV-1a de 32 bits: transforma a semente em texto num inteiro. */
export function hashSemente(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function geradorSemente(semente: number): () => number {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Devolve as alternativas em ordem embaralhada de forma estável para a semente.
 *
 * Quando `habilitado` é falso, devolve a lista intacta: é o caso das questões
 * cujas alternativas são rótulos de uma figura ("A", "B", "C" apontando para a
 * imagem), em que embaralhar quebraria a correspondência com o desenho.
 */
export function embaralhaAlternativas<T extends ComId>(
  alternativas: T[] | undefined,
  semente: string,
  habilitado = true
): T[] {
  if (!Array.isArray(alternativas) || alternativas.length <= 1) return alternativas ?? [];
  if (!habilitado) return [...alternativas];

  const rand = geradorSemente(hashSemente(semente));
  const saida = [...alternativas];
  for (let i = saida.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [saida[i], saida[j]] = [saida[j], saida[i]];
  }
  return saida;
}

/**
 * Diz se a questão pode ter as alternativas embaralhadas.
 *
 * O padrão é sim; só não embaralha quando o campo `shuffleOptions` está
 * explicitamente desligado no banco, ou quando alguma alternativa é apenas uma
 * letra solta (rótulo de figura), caso em que embaralhar tornaria o enunciado
 * incoerente com a imagem.
 */
export function podeEmbaralhar(questao: {
  shuffleOptions?: boolean | number | null;
  options?: { text?: string | null }[];
}): boolean {
  if (questao?.shuffleOptions === false || questao?.shuffleOptions === 0) return false;
  const opts = Array.isArray(questao?.options) ? questao.options : [];
  const soLetra = opts.filter((o) => /^[A-E]$/i.test(String(o?.text ?? "").trim()));
  if (soLetra.length >= 2) return false;
  return true;
}
