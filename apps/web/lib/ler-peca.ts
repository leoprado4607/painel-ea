/** Classifica e lê uma peça do processo completo (PDF na memória): ficha, contracheque, texto ou imagem. */
import { lerDocumentosPdf, palavrasDoPdf, type Palavra } from "@painel-ea/leitor-ficha";
import type { TipoPeca } from "./processo-completo";

/** Limite de cada peça enviada (o navegador já não manda as maiores). */
export const LIMITE_PECA = 4 * 1024 * 1024;
const LIMITE_TEXTO = 30_000;

/** Texto da peça em linhas, na ordem de leitura (página, altura, coluna). */
export function textoDasPalavras(palavras: Palavra[]): string {
  const ordenadas = [...palavras].sort((a, b) => a.pagina - b.pagina || a.y - b.y || a.x - b.x);
  const linhas: { pagina: number; y: number; partes: Palavra[] }[] = [];
  for (const p of ordenadas) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && ultima.pagina === p.pagina && Math.abs(ultima.y - p.y) < 2.5) ultima.partes.push(p);
    else linhas.push({ pagina: p.pagina, y: p.y, partes: [p] });
  }
  return linhas.map((l) => l.partes.sort((a, b) => a.x - b.x).map((p) => p.texto).join(" ")).join("\n").slice(0, LIMITE_TEXTO);
}

export async function lerPeca(dados: Uint8Array): Promise<{ tipo: TipoPeca; texto?: string }> {
  // só PDF (no ZIP do SPED, algumas peças vêm sem a extensão)
  if (String.fromCharCode(...dados.slice(0, 5)) !== "%PDF-") return { tipo: "ignorada" };
  const palavras = await palavrasDoPdf(dados);
  if (!palavras.length) return { tipo: "imagem" };
  try {
    const docs = await lerDocumentosPdf(dados);
    const [cc] = docs;
    if (cc?.tipo === "contracheque" && (cc.contracheque.cabecalho.banco || cc.contracheque.cabecalho.conta)) return { tipo: "contracheque" };
    if (docs.some((d) => d.tipo === "ficha" && d.ficha.ano && d.ficha.linhas.length)) return { tipo: "ficha" };
  } catch {
    // não é ficha nem contracheque: segue como texto
  }
  return { tipo: "texto", texto: textoDasPalavras(palavras) };
}
