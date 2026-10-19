/// <reference path="./pdfjs-worker.d.ts" />
/** Extrai as palavras (com posição) de um PDF usando o pdf.js da Mozilla. Funciona no Node e no navegador. */
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { Palavra } from "./leitor";

let trabalhadorPronto: Promise<unknown> | null = null;

export async function palavrasDoPdf(dados: Uint8Array): Promise<Palavra[]> {
  // No Node, o pdf.js roda o "worker" no próprio processo.
  trabalhadorPronto ??= typeof window === "undefined" ? import("pdfjs-dist/legacy/build/pdf.worker.mjs") : Promise.resolve();
  await trabalhadorPronto;
  // carregado só quando um PDF é lido: não pesa na partida das páginas que só usam a correspondência
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ data: dados.slice(), isEvalSupported: false, useSystemFonts: false }).promise;
  const palavras: Palavra[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const altura = pagina.getViewport({ scale: 1 }).height;
    const conteudo = await pagina.getTextContent();
    for (const item of conteudo.items as TextItem[]) {
      if (!item.str?.trim()) continue;
      const [a, b, c, , x0, yBase] = item.transform as number[];
      const tamanho = Math.hypot(a!, b!);
      const inclinada = Math.abs(b!) > 0.01 || Math.abs(c!) > 0.01;
      const y = altura - yBase!;
      // um item pode ter várias palavras: divide e estima a posição de cada uma pela proporção de caracteres
      const larguraChar = item.str.length ? item.width / item.str.length : 0;
      let i = 0;
      for (const parte of item.str.split(/(\s+)/)) {
        if (parte.trim()) palavras.push({ texto: parte, x: x0! + i * larguraChar, y, largura: parte.length * larguraChar, pagina: n, tamanho, inclinada });
        i += parte.length;
      }
    }
  }
  await doc.destroy();
  return palavras;
}
