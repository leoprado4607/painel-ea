import { describe, expect, it } from "vitest";
import { aplicarCorrespondencia, CORRESPONDENCIA_PADRAO, periodoDasFichas } from "../src/correspondencia";
import type { FichaFinanceira, LinhaFicha } from "../src/leitor";

const meses = (v: number, ate = 12) => Array.from({ length: 12 }, (_, i) => (i < ate ? v : 0));
const lin = (codigo: string, v: number, ate = 12): LinhaFicha => ({
  codigo, descricao: codigo, natureza: codigo.startsWith("NR") || codigo.startsWith("AR") ? "receita" : "desconto",
  acerto: codigo.startsWith("A"), meses: meses(v, ate), total: v * ate,
});
const ficha = (ano: number, linhas: LinhaFicha[]): FichaFinanceira => ({
  ano, linhas, totaisLiquidos: null, avisos: [],
  cabecalho: { posto: null, nome: null, precCp: null, identidade: null, cpf: null, codom: null, rm: null, siglaUa: null },
  conferencias: { linhasDivergentes: [], mesesDivergentes: [], ok: true },
});
const rubricas = [
  { posicao: 1, codigo: "A01 - SOLDO" }, { posicao: 6, codigo: "AD2 - ADICIONAL FÉRIAS" },
  { posicao: 13, codigo: "Z01 - FUSEX" }, { posicao: 7, codigo: "" },
];

describe("correspondência SIPPES → rubricas do processo", () => {
  it("leva cada código para a posição da rubrica e lista o que não foi usado", () => {
    const r = aplicarCorrespondencia([ficha(2025, [lin("NR0001", 5000, 4), lin("ND0001", 150, 4), lin("ND0010", 900, 4), lin("ND0042", 2, 1)])],
      rubricas, CORRESPONDENCIA_PADRAO);
    expect(r.lancamentos.filter((l) => l.posicao === 1)).toHaveLength(4);
    expect(r.lancamentos.find((l) => l.posicao === 13 && l.mes === 1)?.valor).toBe(150);
    expect(r.naoUsadas.map((l) => l.codigo)).toEqual(["ND0010", "ND0042"]);
  });
  it("rubrica que o processo não usa não recebe valor", () => {
    const r = aplicarCorrespondencia([ficha(2025, [lin("NR0003", 100)])], rubricas, CORRESPONDENCIA_PADRAO);
    expect(r.lancamentos).toEqual([]);
    expect(r.naoUsadas.map((l) => l.codigo)).toEqual(["NR0003"]);
  });
  it("escolha da OM soma o acerto à mesma posição", () => {
    const r = aplicarCorrespondencia([ficha(2025, [lin("ND0001", 150, 1), lin("ND0042", 2.19, 1)])], rubricas, CORRESPONDENCIA_PADRAO, { ND0042: 13 });
    expect(r.lancamentos).toEqual([{ ano: 2025, mes: 1, posicao: 13, valor: 152.19, codigosSippes: ["ND0001", "ND0042"] }]);
  });
  it("período: de janeiro do 1º ano ao último mês com valor", () => {
    expect(periodoDasFichas([ficha(2025, [lin("NR0001", 1)]), ficha(2026, [lin("NR0001", 1, 4)])])).toEqual({ inicio: "2025-01-01", fim: "2026-04-01" });
  });
});
