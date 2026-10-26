import { lerContracheque, contrachequeComoFicha, type Contracheque } from "./contracheque";
import { ehFichaSiappes, lerFicha, lerFichasSiappes, type FichaFinanceira } from "./leitor";
import { palavrasDoPdf } from "./pdf";

export * from "./leitor";
export * from "./contracheque";
export { palavrasDoPdf } from "./pdf";

/** Lê uma Ficha Financeira do SIPPES em PDF. */
export async function lerFichaPdf(dados: Uint8Array): Promise<FichaFinanceira> {
  return lerFicha(await palavrasDoPdf(dados));
}

/** Lê um contracheque (Comprovante Mensal de Rendimentos do CPEx) em PDF. */
export async function lerContrachequePdf(dados: Uint8Array): Promise<Contracheque> {
  return lerContracheque(await palavrasDoPdf(dados));
}

/**
 * PDF sem nenhum texto: as letras viraram desenho. Acontece ao imprimir a página do SIPPES na impressora
 * "Microsoft Print to PDF"; o "Salvar como PDF" do Chrome/Edge mantém o texto (conferido em 26/10/2026).
 */
export class PdfSemTexto extends Error {
  constructor() {
    super("PDF sem texto (impresso como imagem)");
    this.name = "PdfSemTexto";
  }
}

export type DocumentoLido =
  | { tipo: "contracheque"; contracheque: Contracheque; ficha: FichaFinanceira }
  | { tipo: "ficha"; ficha: FichaFinanceira };

/**
 * Reconhece o tipo pelo título e lê o PDF. O contracheque também volta convertido em "ficha de um mês",
 * para a correspondência de rubricas e a gravação dos valores recebidos serem as mesmas.
 * A ficha do SIAPPES (sistema antigo) pode trazer vários anos: volta um documento por ano.
 */
export async function lerDocumentosPdf(dados: Uint8Array): Promise<DocumentoLido[]> {
  const palavras = await palavrasDoPdf(dados);
  if (!palavras.length) throw new PdfSemTexto();
  const texto = palavras.slice(0, 400).map((p) => p.texto.toUpperCase()).join(" ");
  if (/COMPROVANTE MENSAL DE RENDIMENTOS/.test(texto)) {
    const contracheque = lerContracheque(palavras);
    return [{ tipo: "contracheque", contracheque, ficha: contrachequeComoFicha(contracheque) }];
  }
  if (ehFichaSiappes(palavras)) return lerFichasSiappes(palavras).map((ficha) => ({ tipo: "ficha", ficha }));
  return [{ tipo: "ficha", ficha: lerFicha(palavras) }];
}

/** Um documento só (o primeiro ano, numa ficha do SIAPPES com vários). */
export async function lerDocumentoPdf(dados: Uint8Array): Promise<DocumentoLido> {
  const [doc] = await lerDocumentosPdf(dados);
  return doc ?? { tipo: "ficha", ficha: lerFicha([]) };
}
export * from "./correspondencia";
