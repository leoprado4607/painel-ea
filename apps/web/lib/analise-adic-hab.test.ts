import { describe, expect, it } from "vitest";
import { analisarAdicHab, avosDo13, lancamentosDaAnalise, postosPelaFicha, valorDaAnalise } from "./analise-adic-hab";
import type { FichaLida } from "./receitas";

// série do sistema (IPCA até ago/2025 e IPCA-E depois), jan/2020 a out/2026, como no banco em 27/11/2026
const pct = [0.21, 0.25, 0.07, -0.31, -0.38, 0.26, 0.36, 0.24, 0.64, 0.86, 0.89, 1.35,
  0.25, 0.86, 0.93, 0.31, 0.83, 0.53, 0.96, 0.87, 1.16, 1.25, 0.95, 0.73,
  0.54, 1.01, 1.62, 1.06, 0.47, 0.67, -0.68, -0.36, -0.29, 0.59, 0.41, 0.62,
  0.53, 0.84, 0.71, 0.61, 0.23, -0.08, 0.12, 0.23, 0.26, 0.24, 0.28, 0.56,
  0.42, 0.83, 0.16, 0.38, 0.46, 0.21, 0.38, -0.02, 0.44, 0.56, 0.39, 0.52,
  0.16, 1.31, 0.56, 0.43, 0.26, 0.24, 0.26, -0.11, 0.48, 0.18, 0.2, 0.25,
  0.2, 0.84, 0.44, 0.89, 0.62, 0.41, 0.06, -0.4, 0.7, 0.32];
const indices = pct.map((p, i) => ({ ano: 2020 + Math.floor(i / 12), mes: (i % 12) + 1, percentual: p }));
const L = (codigo: string, meses: number[]) => ({ codigo, descricao: codigo, meses });
const doze = (v: number) => Array(12).fill(v) as number[];

// 2º Ten Mulatinho (64592.002508/2026-50): majoração de 12% para 45% (aperfeiçoamento) a contar de 03/08/2023
const mulatinho: FichaLida[] = [
  { ano: 2023, sistema: "sippes", linhas: [
    L("NR0001", [0, 0, 0, 0, 0, 0, 7315, 7315, 7315, 7315, 7315, 7315]), L("NR0003", [0, 0, 0, 0, 0, 0, 0, 0, 877.8, 877.8, 877.8, 877.8]),
    L("NR0014", [0, 0, 0, 0, 0, 0, 1389.85, 1389.85, 1389.85, 1389.85, 1389.85, 1389.85]), L("NR0085", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4974.2, 0]),
    L("NR0170", [0, 0, 0, 0, 0, 0, 365.75, 365.75, 365.75, 365.75, 365.75, 365.75]), L("AR0003", [0, 0, 0, 0, 0, 0, 0, 0, 0, 849.48, 0, 0])] },
  { ano: 2024, sistema: "sippes", linhas: [
    L("NR0001", doze(7490)), L("NR0003", [898.8, 898.8, 898.8, 898.8, 898.8, 898.8, 898.8, 898.8, 3370.5, 3370.5, 3370.5, 3370.5]), L("NR0014", doze(1423.1)),
    L("NR0084", [0, 0, 0, 0, 0, 5093.2, 0, 0, 0, 0, 0, 0]), L("NR0085", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7564.9, 0]), L("NR0092", [0, 0, 0, 0, 3395.47, 0, 0, 0, 0, 0, 0, 0]),
    L("NR0170", doze(374.5)), L("AR0003", [0, 0, 0, 0, 0, 0, 0, 0, 17301.9, 0, 0, 0])] },
  { ano: 2025, sistema: "sippes", linhas: [L("NR0001", [7490, 7490, 7490, 7827, 7827, 7827, 7827, 7827, 7827, 7827, 7827, 7827]), L("NR0003", [3370.5, 3370.5, 3370.5, 3522.15, 3522.15, 3522.15, 3522.15, 3522.15, 3522.15, 3522.15, 3522.15, 3522.15])] },
];

// 2º Sgt Quinebre (64036.002843/2026-63): ETAC em 23/04/2021, aperfeiçoamento escalonado pela lei
const quinebre: FichaLida[] = [
  { ano: 2021, sistema: "siappes", linhas: [L("A01", doze(3825)), L("A03", doze(459)), L("A07", [0, 0, 765, 765, 765, 765, 765, 765, 765, 765, 765, 765]), L("A14", doze(612)),
    L("A84", [0, 0, 0, 0, 0, 2945.25, 0, 0, 0, 0, 0, 0]), L("A85", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5890.5, 0]), L("AD2", [0, 0, 0, 0, 1963.5, 0, 0, 0, 0, 0, 0, 0]), L("AL0", doze(229.5))] },
  { ano: 2022, sistema: "siappes", linhas: [L("A01", doze(3825)), L("A03", doze(459)), L("A07", doze(765)), L("A14", doze(612)),
    L("A84", [0, 0, 0, 0, 0, 2945.25, 0, 0, 0, 0, 0, 0]), L("A85", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5890.5, 0]), L("AD2", [0, 0, 0, 0, 0, 0, 0, 0, 1963.5, 0, 0, 0]), L("AL0", doze(229.5))] },
  { ano: 2023, sistema: "siappes", linhas: [L("A01", doze(3825)), L("A03", doze(459)), L("A07", [765, 765, 765, 0, 0, 0, 0, 0, 0, 0, 0, 0]), L("A14", doze(612)),
    L("A84", [0, 0, 0, 0, 0, 2562.75, 0, 0, 0, 0, 0, 0]), L("A85", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5125.5, 0]), L("AD2", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1708.5, 0]), L("AL0", doze(229.5))] },
  { ano: 2024, sistema: "sippes", linhas: [L("NR0001", [3825, 3825, 3825, 3825, 3825, 4770, 4770, 4770, 4770, 4770, 4770, 4770]), L("NR0003", [459, 459, 459, 459, 459, 572.4, 572.4, 572.4, 572.4, 572.4, 572.4, 572.4]),
    L("NR0014", [612, 612, 612, 612, 612, 763.2, 763.2, 763.2, 763.2, 763.2, 763.2, 763.2]), L("NR0084", [0, 0, 0, 0, 0, 3339, 0, 0, 0, 0, 0, 0]), L("NR0085", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3339, 0]),
    L("NR0092", [0, 0, 0, 0, 0, 0, 0, 2226, 0, 0, 0, 0]), L("NR0170", [229.5, 229.5, 229.5, 229.5, 229.5, 572.4, 572.4, 572.4, 572.4, 572.4, 572.4, 572.4])] },
  { ano: 2025, sistema: "sippes", linhas: [L("NR0001", [4770, 4770, 4770, 4985, 4985, 4985, 4985, 4985, 4985, 4985, 4985, 4985]), L("NR0003", [572.4, 572.4, 572.4, 598.2, 598.2, 598.2, 598.2, 598.2, 598.2, 598.2, 598.2, 598.2]),
    L("NR0014", [763.2, 763.2, 763.2, 797.6, 797.6, 797.6, 797.6, 797.6, 797.6, 797.6, 797.6, 797.6]), L("NR0084", [0, 0, 0, 0, 0, 3489.5, 0, 0, 0, 0, 0, 0]), L("NR0085", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3489.5, 0]),
    L("NR0092", [0, 0, 0, 0, 0, 0, 0, 2326.33, 0, 0, 2326.33, 0]), L("NR0170", [572.4, 572.4, 572.4, 598.2, 598.2, 598.2, 598.2, 598.2, 598.2, 598.2, 598.2, 598.2])] },
  { ano: 2026, sistema: "sippes", linhas: [L("NR0001", [5209, 5209, 5209, 5209, 5209, 5209, 5209, 5209, 5209, 5209, 5209, 0]),
    L("NR0003", [625.08, 625.08, 625.08, 625.08, 625.08, 2344.05, 2344.05, 2344.05, 2344.05, 2344.05, 2344.05, 0]), L("AR0003", [0, 0, 0, 0, 0, 3437.94, 0, 0, 0, 0, 0, 0])] },
];

describe("análise do Adicional de Habilitação", () => {
  it("Mulatinho: estende o período, sugere a promoção, liga os dois atrasados e chega ao valor já conferido", () => {
    const a = analisarAdicHab({ fichas: mulatinho, inicio: "2023-08-03", fim: "2023-12-31", hoje: "2026-11-27", dataRequerimento: "2025-05-29",
      dados: { tipo: "aperfeicoamento", curso: "Curso de Residência Médica em Dermatologia", documento: "BI nº 123, do HGuN, de 1º JUL 24", percentualPedido: 45 } });
    expect(a.pronta).toBe(true);
    expect(a.fimSugerido).toBe("2024-08-31");
    expect(a.postos.map((p) => [p.desde, p.categoria])).toEqual([["2023-08-03", "asp"], ["2024-01-01", "2-ten"]]);
    expect(a.percentualRecebido).toBe(12);
    expect(a.natalino.map((n) => [n.ano, n.avos, n.valor])).toEqual([[2023, 6, 1206.98]]);
    expect(a.ferias).toEqual([{ ano: 2024, mes: 5, valor: 823.9 }]);
    expect(a.atrasados.map((x) => [x.tipo, x.mes, x.meses.map((m) => `${m.mes}/${m.ano}`).join(",")])).toEqual([
      ["percentual-antigo", 10, "8/2023"], ["majoracao", 9, "2/2024,3/2024,4/2024,5/2024,6/2024,7/2024,8/2024"]]);
    const dig = Object.fromEntries(a.lancamentosDigitados.map((d) => [`${d.tipo} ${d.rubrica.slice(0, 3)} ${d.mes}/${d.ano}`, d.valor]));
    expect(dig["recebido A03 8/2023"]).toBe(821.17);
    expect(dig["recebido Z01 8/2023"]).toBe(24.64);
    expect(dig["recebido A03 2/2024"]).toBe(3370.5);
    expect(dig["recebido Z02 8/2024"]).toBe(259.53);
    expect(a.memoria.find((m) => m.ano === 2024 && m.mes === 1)!.diferenca).toBe(2471.7);
    expect(a.memoria.find((m) => m.ano === 2024 && m.mes === 3)!.diferenca).toBe(0);
    expect(a.pendencias.some((p) => /aditar o requerimento/.test(p))).toBe(true);
    expect(a.textos.explicacao!.length).toBeLessThanOrEqual(800);
    expect(valorDaAnalise(a, indices)!.corrigido).toBe(16599.56);
  });

  it("Quinebre: percentual escalonado da lei, promoção, natalino 12/12, férias e o atrasado de 2026 fora do período", () => {
    const a = analisarAdicHab({ fichas: quinebre, inicio: "2021-04-23", fim: "2025-12-31", hoje: "2026-11-27", dataRequerimento: "2026-03-17",
      dados: { tipo: "aperfeicoamento", documento: "BI nº 80, de 04/05/2026, do 7º BE Cmb", percentualPedido: 45 } });
    expect(a.fimSugerido).toBeNull();
    expect(a.faixas.map((f) => [f.de, f.ate, f.percentual, f.diferenca])).toEqual([
      ["2021-04-23", "2021-06-30", 27, 15], ["2021-07-01", "2022-06-30", 34, 22], ["2022-07-01", "2023-06-30", 41, 29], ["2023-07-01", "2025-12-31", 45, 33]]);
    expect(a.postos.map((p) => [p.desde, p.categoria])).toEqual([["2021-04-23", "3-sgt"], ["2024-06-01", "2-sgt"]]);
    expect(a.natalino.map((n) => [n.ano, n.avos])).toEqual([[2021, 12], [2022, 12], [2023, 12], [2024, 12], [2025, 12]]);
    expect(a.ferias.length).toBe(6);
    expect(a.atrasados.map((x) => x.tipo)).toEqual(["fora-do-periodo"]);
    expect(a.lancamentosDigitados).toEqual([]);
    expect(a.faltas).toEqual([]);
    expect(valorDaAnalise(a, indices)!.corrigido).toBe(78595.6);
  });

  it("desconto do adicional pago (G03) estorna o mês; Pensão Militar e Fusex de dependentes lidos nos descontos", () => {
    const fichas: FichaLida[] = [{ ano: 2020, sistema: "siappes",
      linhas: [L("A01", [0, 0, 0, 0, 0, 0, 2627, 2627, 2627, 2627, 2627, 2627]), L("A03", [0, 0, 0, 0, 0, 0, 315.24, 0, 0, 0, 0, 0]), L("A14", [0, 0, 0, 0, 0, 0, 341.51, 341.51, 341.51, 341.51, 341.51, 341.51]),
        L("AL0", [0, 0, 0, 0, 0, 0, 157.62, 157.62, 157.62, 157.62, 157.62, 157.62]), L("A85", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1823.58, 0])],
      descontos: [L("G03", [0, 0, 0, 0, 0, 0, 0, 315.24, 0, 0, 0, 0]), L("ZKC", [0, 0, 0, 0, 0, 0, 0, 296.98, 296.98, 296.98, 296.98, 296.98]), L("ZM5", [0, 0, 0, 0, 0, 0, 0, 0, 14.05, 15.63, 15.63, 15.63])] }];
    const a = analisarAdicHab({ fichas, inicio: "2020-07-01", fim: "2020-12-31", hoje: "2026-11-27", dados: { tipo: "formacao", documento: "BI 1" } });
    expect(a.atrasados.map((x) => [x.tipo, x.meses[0]?.mes])).toEqual([["estorno", 7]]);
    expect(a.memoria.find((m) => m.mes === 7)!.diferenca).toBe(315.24);
    expect(a.dados.pensao).toBe(9.5);
    expect(a.dados.fusexDependentes).toBe(0.5);
    const dig = a.lancamentosDigitados.map((d) => [d.tipo, d.rubrica.slice(0, 3), d.mes, d.valor]);
    expect(dig).toContainEqual(["recebido", "A03", 7, 0]);
    expect(dig).toContainEqual(["devido", "Z01", 7, 9.46]);
    expect(dig).toContainEqual(["devido", "Z02", 7, 29.95]);
    expect(avosDo13(fichas, 2020)!.avos).toBe(7);
    expect(a.natalino[0]!.avos).toBe(7);
  });

  it("sem a data de início ou o tipo do curso, lista o que falta e não calcula", () => {
    const a = analisarAdicHab({ fichas: mulatinho, inicio: null, fim: null, hoje: "2026-11-27", dados: {} });
    expect(a.pronta).toBe(false);
    expect(a.faltas.length).toBe(2);
    expect(lancamentosDaAnalise(a)).toEqual([]);
  });

  it("postos pela ficha: só muda de linha quando o soldo é de outro posto (reajuste não é promoção)", () => {
    expect(postosPelaFicha(quinebre, "2024-01-01", "2025-12-31").map((p) => p.categoria)).toEqual(["3-sgt", "2-sgt"]);
  });
});
