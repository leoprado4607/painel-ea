import { CORRESPONDENCIA_PADRAO, type FichaFinanceira } from "@painel-ea/leitor-ficha";
import { describe, expect, it } from "vitest";
import type { DocumentoExtraido } from "./favorecido";
import { fichasLidasDosDocumentos, fichasLidasValidas, mesclarFichasLidas, receitasDoPeriodo, type FichaLida } from "./receitas";

const meses = (v: number) => Array.from({ length: 12 }, () => v);
const doc = (ano: number, linhas: [string, "receita" | "desconto", number][], sistema: "sippes" | "siappes" = "sippes"): DocumentoExtraido => ({
  arquivo: `f${ano}.pdf`, tipo: "ficha",
  ficha: {
    sistema, ano, totaisLiquidos: null, avisos: [],
    cabecalho: { posto: null, nome: null, precCp: null, identidade: null, cpf: null, codom: null, rm: null, siglaUa: null },
    conferencias: { linhasDivergentes: [], mesesDivergentes: [], ok: true },
    linhas: linhas.map(([codigo, natureza, v]) => ({ codigo, natureza, acerto: false, descricao: codigo, meses: meses(v), total: v * 12 })),
  } satisfies FichaFinanceira,
});
const rubricas = [
  { posicao: 1, codigo: "A01 - SOLDO", tipo: "Receita" }, { posicao: 2, codigo: "A03 - ADIC HAB", tipo: "Receita" },
  { posicao: 3, codigo: "", tipo: "Receita" },
  { posicao: 13, codigo: "Z01 - FUSEX", tipo: "Despesa" },
];

describe("receitas das fichas", () => {
  it("guarda só as linhas de receita das fichas (o contracheque não entra)", () => {
    const f = fichasLidasDosDocumentos([doc(2025, [["NR0001", "receita", 100], ["ND0001", "desconto", 10]]),
      { ...doc(2026, [["NR0001", "receita", 1]]), tipo: "contracheque" }]);
    expect(f).toEqual([{ ano: 2025, sistema: "sippes", linhas: [{ codigo: "NR0001", descricao: "NR0001", meses: meses(100) }] }]);
    expect(fichasLidasValidas(f)).toEqual(f);
    expect(fichasLidasValidas([{ ano: "x" }, null])).toEqual([]);
  });

  it("a ficha nova de um ano substitui a guardada", () => {
    const a: FichaLida = { ano: 2024, sistema: "siappes", linhas: [] }, b: FichaLida = { ano: 2025, sistema: "sippes", linhas: [] };
    expect(mesclarFichasLidas([a, b], [{ ...b, sistema: "siappes" }])).toEqual([a, { ...b, sistema: "siappes" }]);
  });

  it("só receitas das rubricas escolhidas, só no período da dívida; despesas e códigos sem rubrica ficam de fora", () => {
    const fichas = fichasLidasDosDocumentos([
      doc(2024, [["A01", "receita", 900], ["A14", "receita", 50], ["Z01", "desconto", 30]], "siappes"),
      doc(2025, [["NR0001", "receita", 1000], ["NR0003", "receita", 200], ["ND0001", "desconto", 30]]),
    ]);
    const r = receitasDoPeriodo(fichas, rubricas, CORRESPONDENCIA_PADRAO, "2024-11-15", "2025-02-01");
    expect(r).toEqual([
      { ano: 2024, mes: 11, posicao: 1, valor: 900 }, { ano: 2024, mes: 12, posicao: 1, valor: 900 },
      { ano: 2025, mes: 1, posicao: 1, valor: 1000 }, { ano: 2025, mes: 1, posicao: 2, valor: 200 },
      { ano: 2025, mes: 2, posicao: 1, valor: 1000 }, { ano: 2025, mes: 2, posicao: 2, valor: 200 },
    ]);
    expect(receitasDoPeriodo(fichas, rubricas, CORRESPONDENCIA_PADRAO, null, "2025-02-01")).toEqual([]); // sem período, nada
  });
});
