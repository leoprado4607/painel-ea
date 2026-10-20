import type { Complementos } from "@painel-ea/documentos";

/** Campos do processo que as abas dos documentos podem editar (os demais ficam em "Dados do favorecido"). */
const DO_PROCESSO = ["numero", "ano", "data_solicitacao_extenso", "data_requerimento"] as const; // averbação: em Dados do favorecido
const NUMERICOS = new Set(["ano"]);
/** Complementos editáveis: "grupo.campo" ou "campo". Anexos são quantidades. */
const COMPLEMENTOS = [
  "anexos.fichas", "anexos.folhasCalculo", "anexos.recapitulacao", "anexos.comprovacao", "anexos.bi",
  "amparo", "explicacao", "parecer",
  "pensao.nome", "pensao.cpf", "pensao.banco", "pensao.agencia", "pensao.conta",
  "operadorCpex.nome", "operadorCpex.cpf",
] as const;

/**
 * Lê do formulário só os campos presentes (cada aba envia os seus) e mescla com o que já está gravado.
 */
export function lerFormularioDocumento(f: FormData, atuais: Complementos) {
  const processo: Record<string, string | number | boolean | null> = {};
  for (const k of DO_PROCESSO) {
    if (!f.has(k)) continue;
    const v = String(f.get(k) ?? "").trim();
    processo[k] = v === "" ? null : NUMERICOS.has(k) ? Number(v) : v;
  }
  if (f.has("possui_pensao_judicial_enviado")) processo.possui_pensao_judicial = f.get("possui_pensao_judicial") === "on";

  const comp = structuredClone(atuais) as Record<string, unknown>;
  for (const chave of COMPLEMENTOS) {
    const nome = `c.${chave}`;
    if (!f.has(nome)) continue;
    const bruto = String(f.get(nome) ?? "").trim();
    const [grupo, campo] = chave.includes(".") ? chave.split(".") as [string, string] : [null, chave];
    const valor = grupo === "anexos" ? (bruto === "" ? null : Math.max(0, Math.floor(Number(bruto)) || 0)) : bruto;
    if (grupo) comp[grupo] = { ...(comp[grupo] as object | undefined), [campo]: valor };
    else comp[campo] = valor;
  }
  return { processo, complementos: comp as Complementos };
}
