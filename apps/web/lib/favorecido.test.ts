import type { Contracheque, FichaFinanceira } from "@painel-ea/leitor-ficha";
import { describe, expect, it } from "vitest";
import { bancoDaLista, dadosDoFavorecido, fichaValida, periodoDosDocumentos, type DocumentoExtraido } from "./favorecido";
import { omDeVinculacao } from "./tipos";

describe("OM de vinculação", () => {
  it("pelo CODOM (com ou sem zeros) ou pelo nome escrito de outro jeito", () => {
    expect(omDeVinculacao(null, "1420")).toEqual({ codom: "001420", nome: "B Adm Gu Natal" });
    expect(omDeVinculacao("B ADM GU NATAL")?.codom).toBe("001420");
    expect(omDeVinculacao("16 B I MTZ")?.codom).toBe("007807");
    expect(omDeVinculacao("hgun")?.codom).toBe("061200");
    expect(omDeVinculacao("Cia C/Cmdo 7ª Bda Inf Mtz")?.codom).toBe("030007");
    expect(omDeVinculacao("CIA CMDO 2 BDA INF SL", "029173")).toBeUndefined();
  });
});

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
    expect(bancoDaLista("1")).toBe("001 - Banco do Brasil");
    expect(bancoDaLista("0104")).toBe("104 - CEF");
    expect(bancoDaLista("77")).toBe("077");
    expect(bancoDaLista(null)).toBeUndefined();
  });

  it("a ficha traz os dados do militar; o contracheque, banco, agência, conta e a OM de vinculação (pelo CODOM)", () => {
    const r = dadosDoFavorecido([{ arquivo: "f.pdf", tipo: "ficha", ficha: ficha(2025, { 1: 1 }) }, contracheque(2026, 8)]);
    expect(r).toEqual({
      posto_graduacao: "Maj", nome: "FULANO DE TAL", prec_cp: "111111111", identidade: "0123456789", cpf: "529.982.247-25",
      om_vinculacao: "B Adm Gu Natal", banco: "001 - Banco do Brasil", agencia: "2857", conta: "0005593204", om_do_contracheque: true,
    });
    // sem contracheque, a OM da ficha (fora da lista, fica o texto lido para o operador trocar)
    expect(dadosDoFavorecido([{ arquivo: "f.pdf", tipo: "ficha", ficha: ficha(2025, { 1: 1 }) }]).om_vinculacao).toBe("OM DA FICHA");
    // OM só da ficha: sem a marca do contracheque (não substitui uma OM já preenchida no formulário)
    expect(dadosDoFavorecido([{ arquivo: "f.pdf", tipo: "ficha", ficha: ficha(2025, { 1: 1 }) }]).om_do_contracheque).toBeUndefined();
    expect(dadosDoFavorecido([{ arquivo: "f.pdf", tipo: "ficha", ficha: ficha(2025, { 1: 1 }, { siglaUa: "16 B I MTZ", codom: "007807" }) }]).om_vinculacao)
      .toBe("16º BI Mtz");
  });

  it("período: das fichas, de janeiro ao último mês com valor; o contracheque não conta", () => {
    expect(periodoDosDocumentos([contracheque(2026, 8)])).toBeNull();
    expect(periodoDosDocumentos([{ arquivo: "f", tipo: "ficha", ficha: ficha(2025, { 3: 1, 11: 1 }) }, contracheque(2026, 2)]))
      .toEqual({ inicio: "2025-01-01", fim: "2025-11-01" });
    expect(periodoDosDocumentos([{ arquivo: "f", tipo: "ficha", ficha: ficha(2025, {}) }])).toBeNull();
  });

  it("só aceita de volta da tela de revisão algo com forma de ficha", () => {
    expect(fichaValida(ficha(2025, { 1: 10 }))).toBe(true);
    expect(fichaValida({ ...ficha(2025, {}), ano: 1990 })).toBe(false);
    expect(fichaValida({ ...ficha(2025, {}), linhas: [{ codigo: "XX1", meses: [] }] })).toBe(false);
    expect(fichaValida(null)).toBe(false);
    // ficha do SIAPPES: códigos de 3 caracteres
    expect(fichaValida({ ...ficha(2021, {}), linhas: [{ ...ficha(2021, { 1: 1 }).linhas[0]!, codigo: "A01" }] })).toBe(true);
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
  it("preenche os dados bancários; os valores lidos são de um mês só", async () => {
    const lido = await lerDocumentoPdf(new Uint8Array(readFileSync(join(PASTA, arq))));
    const doc: DocumentoExtraido = { arquivo: arq, tipo: lido.tipo, ficha: lido.ficha, contracheque: lido.tipo === "contracheque" ? lido.contracheque : undefined };
    const dados = dadosDoFavorecido([doc]);
    expect(Object.keys(dados).sort()).toEqual(["agencia", "banco", "conta", "om_do_contracheque", "om_vinculacao"]);
    expect(cpfValido(doc.contracheque!.cabecalho.cpf!)).toBe(true);
    expect(fichaValida(doc.ficha)).toBe(true);
    expect(periodoDosDocumentos([doc])).toBeNull(); // valores só das fichas
    const rubricas = CORRESPONDENCIA_PADRAO.map((c, i) => ({ posicao: i + 1, codigo: c.codigoRubrica }));
    const r = aplicarCorrespondencia([doc.ficha], rubricas, CORRESPONDENCIA_PADRAO);
    expect(r.lancamentos.length).toBeGreaterThan(2);
    expect(new Set(r.lancamentos.map((l) => `${l.ano}-${l.mes}`)).size).toBe(1); // um mês só
  });
});

const FICHA_2026 = join(__dirname, "..", "..", "..", "exemplos", "fichas", "Ficha Financeira - 2026 (out-2026).pdf");
describe.skipIf(reais.length === 0 || !existsSync(FICHA_2026))("ficha + contracheque reais juntos", () => {
  it("identidade vem da Ficha Financeira; banco, agência, conta e OM de vinculação do contracheque", async () => {
    const extrair = async (caminho: string, arquivo: string): Promise<DocumentoExtraido> => {
      const d = await lerDocumentoPdf(new Uint8Array(readFileSync(caminho)));
      return { arquivo, tipo: d.tipo, ficha: d.ficha, contracheque: d.tipo === "contracheque" ? d.contracheque : undefined };
    };
    const ficha = await extrair(FICHA_2026, "ficha.pdf");
    const cc = await extrair(join(PASTA, reais[0]!), "contracheque.pdf");
    const dados = dadosDoFavorecido([cc, ficha]); // a ordem de envio não importa
    expect(dados.identidade).toBe(ficha.ficha.cabecalho.identidade);
    expect(dados.identidade).toMatch(/^\d{10}$/);
    expect(dados.banco).toBe(bancoDaLista(cc.contracheque!.cabecalho.banco));
    expect(dados.om_vinculacao).toBe(omDeVinculacao(null, cc.contracheque!.cabecalho.codom)?.nome);
    expect(dadosDoFavorecido([cc]).identidade).toBeUndefined(); // o contracheque sozinho não traz identidade
  });
});

describe("quantidade de meses do período da dívida", () => {
  it("mês com 1 dia no período conta inteiro", async () => {
    const { quantidadeMeses } = await import("./tipos");
    expect(quantidadeMeses("2025-01-15", "2025-03-02")).toBe(3);
    expect(quantidadeMeses("2025-01-31", "2025-01-31")).toBe(1);
    expect(quantidadeMeses("2024-12-31", "2025-01-01")).toBe(2);
    expect(quantidadeMeses("2021-01-01", "2024-12-31")).toBe(48);
    expect(quantidadeMeses("2025-03-01", "2025-01-01")).toBeNull();
    expect(quantidadeMeses("2025-03-01", "")).toBeNull();
  });
});
