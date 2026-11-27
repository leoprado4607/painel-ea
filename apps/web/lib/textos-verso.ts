import { normalizarFormatado, textoSemFormatacao } from "@painel-ea/engine";
import { LIMITE_DOCUMENTO } from "@/lib/amparo";

/**
 * Textos do verso (explicação do não pagamento e documentos que materializam o direito) dos cálculos automáticos
 * (Auxílio-fardamento, Grat Rep, gratificações mensais, Adicional de Habilitação). O sistema sugere; o operador pode
 * editar no quadro "Textos sugeridos para o verso". A versão editada fica guardada no quadro do cálculo
 * (complementos.<cálculo>.textosVerso) e só vai para o verso quando ele marca "substituir".
 */
export interface TextosVerso { explicacao: string; documentos: string[] }

/** Mesmo limite da explicação em Informações. */
export const LIMITE_EXPLICACAO = 800;

/** Sugestão do cálculo como marcação (a mesma forma gravada pelo editor). */
export const textosSugeridos = (t: { explicacao: string | null; documentos: string[] }): TextosVerso => ({
  explicacao: normalizarFormatado(t.explicacao ?? ""),
  documentos: t.documentos.map((d) => normalizarFormatado(d)).filter((d) => textoSemFormatacao(d).trim()),
});

export const mesmosTextos = (a: TextosVerso, b: TextosVerso) =>
  a.explicacao === b.explicacao && a.documentos.join("\n") === b.documentos.join("\n");

const vazio = (t: TextosVerso) => !textoSemFormatacao(t.explicacao).trim() && !t.documentos.length;

/** Limpa o que vem da tela: só b/i/u, documentos de uma linha e sem caixas vazias. */
export function limparTextosVerso(v: unknown): TextosVerso | null {
  if (!v || typeof v !== "object") return null;
  const t = v as Partial<TextosVerso>;
  return {
    explicacao: normalizarFormatado(typeof t.explicacao === "string" ? t.explicacao : ""),
    documentos: (Array.isArray(t.documentos) ? t.documentos : []).slice(0, 10)
      .map((d) => normalizarFormatado(typeof d === "string" ? d : "").replace(/\n/g, " ").trim())
      .filter((d) => textoSemFormatacao(d).trim()),
  };
}

/**
 * Grava os textos do verso de um cálculo automático: a edição do operador (quando difere da sugestão) fica no quadro
 * do cálculo; com `usar`, o verso (complementos.explicacao e .amparo) recebe a versão editada ou, sem ela, a sugerida.
 * Devolve a mensagem de erro quando a edição passa dos limites.
 */
export function gravarTextosVerso({ complementos, quadro, sugeridos, editados, usar }: {
  complementos: Record<string, unknown>; quadro: { textosVerso?: TextosVerso };
  sugeridos: TextosVerso; editados: unknown; usar: boolean;
}): string | null {
  const edicao = limparTextosVerso(editados);
  delete quadro.textosVerso;
  if (edicao && !mesmosTextos(edicao, sugeridos)) {
    const n = textoSemFormatacao(edicao.explicacao).trim().length;
    if (n > LIMITE_EXPLICACAO) return `A explicação do não pagamento tem ${n} caracteres; use no máximo ${LIMITE_EXPLICACAO}.`;
    const longo = edicao.documentos.findIndex((d) => textoSemFormatacao(d).trim().length > LIMITE_DOCUMENTO);
    if (longo >= 0) return `O documento ${longo + 1} que materializa o direito passa de ${LIMITE_DOCUMENTO} caracteres.`;
    quadro.textosVerso = edicao;
  }
  if (usar) {
    const final = quadro.textosVerso ?? sugeridos;
    if (vazio(final)) return null;
    if (textoSemFormatacao(final.explicacao).trim()) complementos.explicacao = final.explicacao;
    if (final.documentos.length) complementos.amparo = final.documentos.join("\n");
  }
  return null;
}
