/** Nomes do pacote de documentos emitido ("Download arquivos"). */

/** Nome da pasta e do ZIP: "Processo 640093.005344-2026-43 - SANDRO LUIS DE LIMA GONCALVES" (sem caracteres proibidos). */
export const nomeDoPacote = (numero: string | null, militar: string) =>
  `Processo ${numero || "sem número"} - ${militar}`.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();

/** Caminho do ZIP de uma versão emitida: ao lado do PDF compilado ("emissao-v1.pdf" → "emissao-v1.zip"). */
export const caminhoDoZip = (caminhoPdf: string) => caminhoPdf.replace(/\.pdf$/i, ".zip");
