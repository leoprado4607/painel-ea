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
  expect(a.acumuladoMes[0]).toBe(0.006); // índices não são arredondados a 2 casas
  expect(a.devidoCorrigidoAno[0]).toBe(304.06);
  expect(a.verso.total.corrigido).toBe(304.06);
  expect(a.importanciaBasica).toBe(304.06);
  expect(r.recapitulacao.saldo).toBe(304.06);
  expect(r.cpex.importanciaBasicaTotalCorrigida).toBe(304.06);
  expect(r.cpex.totalSemCorrecao).toBe(302.25);
});
