import { normalizarBusca } from "./busca";

/** Nome completo para comparar: sem acento, sem diferença de maiúsculas e de espaços (o posto fica de fora, pois pode mudar). */
export const chaveDoNome = (nome: string | null | undefined) => {
  const chave = normalizarBusca(nome ?? "");
  return chave === "(nome nao lido)" ? "" : chave;
};

/** Nomes completos que aparecem em mais de um processo. */
export function nomesRepetidos(cards: { nomeCompleto: string }[]): Set<string> {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const { nomeCompleto } of cards) {
    const chave = chaveDoNome(nomeCompleto);
    if (!chave) continue;
    if (vistos.has(chave)) repetidos.add(chave);
    vistos.add(chave);
  }
  return repetidos;
}
