import { expect, it } from "vitest";
import { calcular, type EntradaCalculo } from "../src";

// 3 meses de 100,75 corrigidos por 0,6%: cada mês dá 101,3545 (exibido 101,35)
const entrada: EntradaCalculo = {
  indices: [{ ano: 2024, mes: 1, percentual: 0 }, { ano: 2024, mes: 2, percentual: 0 }, { ano: 2024, mes: 3, percentual: 0.6 }],
  rubricas: [{ codigo: "A56 - AUX FARD 1 SOLDO", tipo: "Receita" }],
  recebido: {},
  devido: { 2024: { 1: [100.75, 100.75, 100.75] } },
  anos: [2024],
  anoInicialTotaisCpex: 2024,
};

it("modo da planilha: arredonda cada mês antes de somar (3 × 101,35)", () => {
  const r = calcular(entrada);
  expect(r.porAno[2024]!.devidoCorrigido[0]!.slice(0, 3)).toEqual([101.35, 101.35, 101.35]);
  expect(r.cpex.importanciaBasicaTotalCorrigida).toBe(304.05);
});

it("modo 'total': soma com todas as casas e arredonda só o total (304,0635 → 304,06)", () => {
  const r = calcular({ ...entrada, arredondamento: "total" });
  const a = r.porAno[2024]!;
  expect(a.devidoCorrigido[0]!.slice(0, 3)).toEqual([101.35, 101.35, 101.35]); // cada mês exibido a 2 casas
  expect(a.acumuladoMes[0]).toBeCloseTo(0.006, 12); // índices não são arredondados a 2 casas
  expect(a.devidoCorrigidoAno[0]).toBe(304.06);
  expect(a.verso.total.corrigido).toBe(304.06);
  expect(a.importanciaBasica).toBe(304.06);
  expect(r.recapitulacao.saldo).toBe(304.06);
  expect(r.cpex.importanciaBasicaTotalCorrigida).toBe(304.06);
  expect(r.cpex.totalSemCorrecao).toBe(302.25);
});

// caso real (DAVI MEIRELES ROSSI SILVA): dez/2025 corrigido até set/2026; acumulado 4,07594…% (a planilha cortava em 4,0759%)
const IPCA_E = [[2025, 12, 0.25], [2026, 1, 0.2], [2026, 2, 0.84], [2026, 3, 0.44], [2026, 4, 0.89], [2026, 5, 0.62],
  [2026, 6, 0.41], [2026, 7, 0.06], [2026, 8, -0.4], [2026, 9, 0.7]].map(([ano, mes, percentual]) => ({ ano: ano!, mes: mes!, percentual: percentual! }));
const davi: EntradaCalculo = {
  indices: IPCA_E,
  rubricas: [{ codigo: "A56 - AUX FARD 1 SOLDO", tipo: "Receita" }, { codigo: "A56 - AUX FARD 1 SOLDO", tipo: "Receita" }],
  recebido: {},
  devido: { 2025: { 1: [...Array(11).fill(null), 7988], 2: [...Array(11).fill(null), 7644] } },
  anos: [2025], anoInicialTotaisCpex: 2025,
};

it("índice acumulado com todas as casas no modo 'total' (16.269,15; com 4,0759% seria 16.269,14)", () => {
  expect(calcular(davi).cpex.importanciaBasicaTotalCorrigida).toBe(16269.14);
  const r = calcular({ ...davi, arredondamento: "total" });
  expect(r.porAno[2025]!.acumuladoMes[11]).toBeCloseTo(0.0407594273879, 12);
  expect(r.porAno[2025]!.devidoCorrigido[0]![11]).toBe(8313.59);
  expect(r.porAno[2025]!.devidoCorrigido[1]![11]).toBe(7955.57);
  expect(r.cpex.importanciaBasicaTotalCorrigida).toBe(16269.15);
});
