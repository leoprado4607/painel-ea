import { lerFicha, type FichaFinanceira } from "./leitor";
import { palavrasDoPdf } from "./pdf";

export * from "./leitor";
export { palavrasDoPdf } from "./pdf";

/** Lê uma Ficha Financeira do SIPPES em PDF. */
export async function lerFichaPdf(dados: Uint8Array): Promise<FichaFinanceira> {
  return lerFicha(await palavrasDoPdf(dados));
}
export * from "./correspondencia";
