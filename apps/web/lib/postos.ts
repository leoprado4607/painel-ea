/**
 * Postos e graduações nas assinaturas dos documentos (decisão de 21/10/2026): "NOME COMPLETO - Abreviação",
 * ex.: "LEONARDO PRADO DO MONTE BORGES - Maj". Abreviações padrão, na ordem hierárquica.
 */
export const POSTOS = ["Cel", "Ten Cel", "Maj", "Cap", "1º Ten", "2º Ten", "Asp", "S Ten", "1º Sgt", "2º Sgt", "3º Sgt", "Cb", "Sd EP", "Sd EV"] as const;

/** "1º SGT", "Primeiro-Sargento" → "1 SGT", "PRIMEIRO SARGENTO": sem acento, º/ª, ponto e hífen. */
const chave = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
  .replace(/[º°ª.]/g, "").replace(/[-_/]/g, " ").replace(/\s+/g, " ").trim();

/** Formas aceitas de cada posto (comparadas pela chave). */
const SINONIMOS: Record<(typeof POSTOS)[number], string[]> = {
  "Cel": ["CEL", "CORONEL"],
  "Ten Cel": ["TEN CEL", "TC", "TENENTE CORONEL"],
  "Maj": ["MAJ", "MAJOR"],
  "Cap": ["CAP", "CAPITAO"],
  "1º Ten": ["1 TEN", "1O TEN", "PRIMEIRO TENENTE"],
  "2º Ten": ["2 TEN", "2O TEN", "SEGUNDO TENENTE"],
  "Asp": ["ASP", "APS", "ASP OF", "ASPIRANTE", "ASPIRANTE A OFICIAL"],
  "S Ten": ["S TEN", "STEN", "SUBTENENTE", "SUB TENENTE"],
  "1º Sgt": ["1 SGT", "1O SGT", "PRIMEIRO SARGENTO"],
  "2º Sgt": ["2 SGT", "2O SGT", "SEGUNDO SARGENTO"],
  "3º Sgt": ["3 SGT", "3O SGT", "TERCEIRO SARGENTO"],
  "Cb": ["CB", "CABO"],
  "Sd EP": ["SD EP", "SOLDADO EP", "SOLDADO EFETIVO PROFISSIONAL"],
  "Sd EV": ["SD EV", "SOLDADO EV", "SOLDADO EFETIVO VARIAVEL"],
};
const PORCHAVE = new Map(Object.entries(SINONIMOS).flatMap(([p, ss]) => ss.map((s) => [s, p])));

/** Abreviação padrão do posto escrito de qualquer forma ("MAJOR" → "Maj"); desconhecido: null. */
export const abreviarPosto = (texto: string | null | undefined) => PORCHAVE.get(chave(texto ?? "")) ?? null;

/**
 * Separa nome e posto de um texto livre ("LEONARDO … - MAJ", "Maj Leonardo …", "LEONARDO … MAJOR"):
 * procura o posto depois do último " - ", no fim ou no começo (até 4 palavras).
 */
export function separarPosto(texto: string | null | undefined): { nome: string; posto: string | null } {
  const t = (texto ?? "").trim();
  const traco = t.lastIndexOf(" - ");
  if (traco > 0) {
    const p = abreviarPosto(t.slice(traco + 3));
    if (p) return { nome: t.slice(0, traco).trim(), posto: p };
  }
  const palavras = t.split(/\s+/);
  for (let n = Math.min(4, palavras.length - 1); n >= 1; n--) {
    const fim = abreviarPosto(palavras.slice(-n).join(" "));
    if (fim) return { nome: palavras.slice(0, -n).join(" ").replace(/\s*-\s*$/, ""), posto: fim };
    const ini = abreviarPosto(palavras.slice(0, n).join(" "));
    if (ini) return { nome: palavras.slice(n).join(" ").replace(/^\s*-\s*/, ""), posto: ini };
  }
  return { nome: t, posto: null };
}

/** Nome na assinatura: "NOME COMPLETO - Abreviação" (posto desconhecido fica como foi escrito; sem posto, só o nome). */
export function nomeNaAssinatura(nome: string | null | undefined, posto?: string | null): string | null {
  const s = posto === undefined ? separarPosto(nome) : { nome: (nome ?? "").trim(), posto: posto?.trim() || null };
  if (!s.nome) return null;
  const p = s.posto ? abreviarPosto(s.posto) ?? s.posto : null;
  return p ? `${s.nome.toUpperCase()} - ${p}` : s.nome.toUpperCase();
}

/** Posto como deve aparecer em documentos e telas: abreviado no padrão ("PRIMEIRO SARGENTO" → "1º Sgt"); desconhecido, como veio. */
export const postoAbreviado = (texto: string | null | undefined) => (texto ? abreviarPosto(texto) ?? texto.trim() : texto ?? null);
