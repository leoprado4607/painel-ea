/**
 * "Documento que materializa o direito": um ou mais documentos, cada um numa linha (até 100 caracteres cada).
 * Gravados juntos em complementos.amparo, separados por quebra de linha; no verso do PDF, um por linha.
 */
export const LIMITE_DOCUMENTO = 100;

export function documentosDoAmparo(amparo: string | null | undefined): string[] {
  const lista = (amparo ?? "").split("\n").map((d) => d.trim()).filter(Boolean);
  return lista.length ? lista : [""];
}
