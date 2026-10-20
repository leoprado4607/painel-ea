import type { Contracheque, FichaFinanceira } from "@painel-ea/leitor-ficha";
import { BANCOS } from "./tipos";

/** Dados do favorecido extraídos dos documentos (só o que foi encontrado; o resto fica como está no cadastro). */
export interface DadosLidos {
  posto_graduacao?: string; nome?: string; prec_cp?: string; identidade?: string; cpf?: string;
  om_vinculacao?: string; banco?: string; agencia?: string; conta?: string;
}

/** Documento já lido, sem o arquivo: é isto que vai e volta entre a tela de revisão e o servidor. */
export interface DocumentoExtraido {
  arquivo: string;
  tipo: "contracheque" | "ficha";
  ficha: FichaFinanceira;
  contracheque?: Contracheque;
}

/** "1" ou "001" → "001 - Brasil" (lista do formulário); código fora da lista fica como veio, com 3 dígitos. */
export function bancoDaLista(codigo: string | null | undefined): string | undefined {
  const d = (codigo ?? "").replace(/\D/g, "");
  if (!d) return undefined;
  const n = Number(d);
  return BANCOS.find((b) => Number(b.slice(0, 3)) === n) ?? d.padStart(3, "0");
}

const definido = (o: Record<string, string | null | undefined>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")) as DadosLidos;

/**
 * Junta o que os documentos trazem do favorecido. O contracheque mais recente tem prioridade
 * (traz banco, agência, conta e OM de vinculação); a ficha completa a identidade.
 */
export function dadosDoFavorecido(docs: DocumentoExtraido[]): DadosLidos {
  const ordem = (d: DocumentoExtraido) => (d.contracheque ? (d.contracheque.ano ?? 0) * 100 + (d.contracheque.mes ?? 0) : (d.ficha.ano ?? 0) * 100);
  const contracheques = docs.filter((d) => d.contracheque).sort((a, b) => ordem(b) - ordem(a));
  const fichas = docs.filter((d) => !d.contracheque).sort((a, b) => ordem(b) - ordem(a));
  let r: DadosLidos = {};
  for (const f of [...fichas].reverse()) {
    const c = f.ficha.cabecalho;
    r = { ...r, ...definido({ posto_graduacao: c.posto, nome: c.nome, prec_cp: c.precCp, identidade: c.identidade, cpf: c.cpf, om_vinculacao: c.siglaUa }) };
  }
  for (const d of [...contracheques].reverse()) {
    const c = d.contracheque!.cabecalho;
    r = { ...r, ...definido({
      posto_graduacao: c.pgPagamento ?? c.pgReal, nome: c.nome, prec_cp: c.precCp, cpf: c.cpf, om_vinculacao: c.omVinculacao,
      banco: bancoDaLista(c.banco), agencia: c.agencia, conta: c.conta,
    }) };
  }
  return r;
}

/**
 * Período coberto: fichas começam em janeiro do ano (como antes); contracheques, no próprio mês.
 * Termina no último mês com algum valor. Datas no formato "2025-01-01".
 */
export function periodoDosDocumentos(docs: DocumentoExtraido[]): { inicio: string; fim: string } | null {
  let ini = Infinity, fim = 0;
  for (const d of docs) {
    const f = d.ficha;
    if (!f.ano) continue;
    let temValor = false;
    f.linhas.forEach((l) => l.meses.forEach((v, i) => { if (v !== 0) { temValor = true; fim = Math.max(fim, f.ano! * 100 + i + 1); } }));
    if (!temValor) continue;
    ini = Math.min(ini, d.contracheque?.mes ? f.ano * 100 + d.contracheque.mes : f.ano * 100 + 1);
  }
  if (!fim) return null;
  const data = (n: number) => `${Math.floor(n / 100)}-${String(n % 100).padStart(2, "0")}-01`;
  return { inicio: data(ini), fim: data(fim) };
}

/** Confere se o que voltou da tela de revisão tem a forma de uma ficha lida (os valores podem ser revistos pela OM). */
export function fichaValida(f: unknown): f is FichaFinanceira {
  const x = f as FichaFinanceira;
  return !!x && Number.isInteger(x.ano) && x.ano! >= 2000 && x.ano! <= 2100 && Array.isArray(x.linhas)
    && x.linhas.every((l) => typeof l.codigo === "string" && /^[A-Z][RD]\d{4}$/.test(l.codigo)
      && Array.isArray(l.meses) && l.meses.length === 12 && l.meses.every((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e7));
}
