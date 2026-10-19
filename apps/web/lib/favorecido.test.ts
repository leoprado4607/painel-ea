import type { Contracheque, FichaFinanceira } from "@painel-ea/leitor-ficha";
import { describe, expect, it } from "vitest";
import { bancoDaLista, dadosDoFavorecido, fichaValida, periodoDosDocumentos, type DocumentoExtraido } from "./favorecido";

const ficha = (ano: number, meses: Partial<Record<number, number>>, cab: Partial<FichaFinanceira["cabecalho"]> = {}): FichaFinanceira => ({
  ano,
  cabecalho: { posto: "MAJOR", nome: "FULANO DE TAL", precCp: "111111111", identidade: "0123456789", cpf: "529.982.247-25", codom: null, rm: null, siglaUa: "OM DA FICHA", ...cab },
  linhas: [{ codigo: "NR0001", natureza: "receita", acerto: false, descricao: "SOLDO", meses: Array.from({ length: 12 }, (_, i) => meses[i + 1] ?? 0), total: 0 }],
  totaisLiquidos: null, conferencias: { linhasDivergentes: [], mesesDivergentes: [], ok: true }, avisos: [],
});
const contracheque = (ano: number, mes: number, banco = "1"): DocumentoExtraido => {
  const c: Contracheque = {
    ano, mes, linhas: [], totais: null, conferencias: { receitasOk: true, despesasOk: true, liquidoOk: true, ok: true }, avisos: [],
    cabecalho: { nome: "FULANO DE TAL", precCp: "111111111", omVinculacao: "B ADM GU NATAL", codom: "001420", pgReal: "MAJOR", pgPagamento: "MAJOR",
      cpf: "529.982.247-25", banco, agencia: "2857", conta: "0005593204" },
  };
  return { arquivo: "cc.pdf", tipo: "contracheque", contracheque: c, ficha: ficha(ano, { [mes]: 5000 }, { identidade: null, siglaUa: "B ADM GU NATAL" }) };
};

describe("dados do favorecido lidos dos documentos", () => {
  it("banco pelo código: 1 → 001 - Brasil; código fora da lista fica com 3 dígitos", () => {
    expect(bancoDaLista("1")).toBe("001 - Brasil");
    expect(bancoDaLista("0104")).toBe("104 - CEF");
    expect(bancoDaLista("77")).toBe("077");
    expect(bancoDaLista(null)).toBeUndefined();
  });

  it("contracheque traz banco, agência, conta e OM de vinculação; a ficha completa a identidade", () => {
    const r = dadosDoFavorecido([{ arquivo: "f.pdf", tipo: "ficha", ficha: ficha(2025, { 1: 1 }) }, contracheque(2026, 8)]);
    expect(r).toEqual({
      posto_graduacao: "MAJOR", nome: "FULANO DE TAL", prec_cp: "111111111", identidade: "0123456789", cpf: "529.982.247-25",
      om_vinculacao: "B ADM GU NATAL", banco: "001 - Brasil", agencia: "2857", conta: "0005593204",
    });
  });

  it("período: ficha começa em janeiro; contracheque no próprio mês; termina no último mês com valor", () => {
    expect(periodoDosDocumentos([contracheque(2026, 8)])).toEqual({ inicio: "2026-08-01", fim: "2026-08-01" });
    expect(periodoDosDocumentos([{ arquivo: "f", tipo: "ficha", ficha: ficha(2025, { 3: 1, 11: 1 }) }, contracheque(2026, 2)]))
      .toEqual({ inicio: "2025-01-01", fim: "2026-02-01" });
    expect(periodoDosDocumentos([{ arquivo: "f", tipo: "ficha", ficha: ficha(2025, {}) }])).toBeNull();
  });

  it("só aceita de volta da tela de revisão algo com forma de ficha", () => {
    expect(fichaValida(ficha(2025, { 1: 10 }))).toBe(true);
    expect(fichaValida({ ...ficha(2025, {}), ano: 1990 })).toBe(false);
    expect(fichaValida({ ...ficha(2025, {}), linhas: [{ codigo: "XX1", meses: [] }] })).toBe(false);
    expect(fichaValida(null)).toBe(false);
  });
});

// Ponta a ponta com os contracheques reais de exemplos/contracheques (fora do Git); pulado se não houver arquivos.
import { aplicarCorrespondencia, CORRESPONDENCIA_PADRAO, lerDocumentoPdf } from "@painel-ea/leitor-ficha";
import { cpfValido } from "@painel-ea/engine";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PASTA = join(__dirname, "..", "..", "..", "exemplos", "contracheques");
const reais = existsSync(PASTA) ? readdirSync(PASTA).filter((f) => f.toLowerCase().endsWith(".pdf")) : [];

describe.skipIf(reais.length === 0).each(reais)("contracheque real %s no fluxo do site", (arq) => {
  it("preenche os dados do favorecido e os recebidos do mês pelas rubricas padrão", async () => {
    const lido = await lerDocumentoPdf(new Uint8Array(readFileSync(join(PASTA, arq))));
    const doc: DocumentoExtraido = { arquivo: arq, tipo: lido.tipo, ficha: lido.ficha, contracheque: lido.tipo === "contracheque" ? lido.contracheque : undefined };
    const dados = dadosDoFavorecido([doc]);
    expect(Object.keys(dados).sort()).toEqual(["agencia", "banco", "conta", "cpf", "nome", "om_vinculacao", "posto_graduacao", "prec_cp"]);
    expect(cpfValido(dados.cpf!)).toBe(true);
    expect(fichaValida(doc.ficha)).toBe(true);
    const periodo = periodoDosDocumentos([doc])!;
    expect(periodo.inicio).toBe(periodo.fim);
    const rubricas = CORRESPONDENCIA_PADRAO.map((c, i) => ({ posicao: i + 1, codigo: c.codigoRubrica }));
    const r = aplicarCorrespondencia([doc.ficha], rubricas, CORRESPONDENCIA_PADRAO);
    expect(r.lancamentos.length).toBeGreaterThan(2);
    expect(new Set(r.lancamentos.map((l) => `${l.ano}-${l.mes}`)).size).toBe(1); // um mês só
  });
});
