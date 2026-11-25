import { describe, expect, it } from "vitest";
import { adicHabAutomatico, percentualAH, planoAdicHab, RUBRICA_ADIC_HAB, RUBRICA_FERIAS, RUBRICA_FUSEX, RUBRICA_NATAL, RUBRICA_PMIL, rubricasAdicHab, tipoPeloPercentual } from "./adic-hab";
import type { FichaLida } from "./receitas";

const linha = (codigo: string, meses: Record<number, number>) =>
  ({ codigo, descricao: codigo, meses: Array.from({ length: 12 }, (_, i) => meses[i + 1] ?? 0) });
const todos = (v: number, de = 1, ate = 12) => Object.fromEntries(Array.from({ length: ate - de + 1 }, (_, i) => [de + i, v]));
const ficha = (ano: number, ...linhas: ReturnType<typeof linha>[]): FichaLida => ({ ano, sistema: "sippes", linhas });
const hoje = "2026-11-25";
const soma = (l: { valor: number }[] = []) => Math.round(l.reduce((s, v) => s + v.valor, 0) * 100) / 100;

describe("Adicional de Habilitação automático", () => {
  it("só com a espécie e nos processos novos", () => {
    expect(adicHabAutomatico({ especie_divida: "Adicional Habilitação", complementos: { calculoAutomaticoAdicHab: true } })).toBe(true);
    expect(adicHabAutomatico({ especie_divida: "Adicional Habilitação", complementos: {} })).toBe(false);
  });

  it("tabela da Lei 13.954/2019, Anexo III, por data", () => {
    expect(percentualAH("aperfeicoamento", "2021-04-23")).toBe(27);
    expect(percentualAH("aperfeicoamento", "2021-07-01")).toBe(34);
    expect(percentualAH("aperfeicoamento", "2022-07-01")).toBe(41);
    expect(percentualAH("aperfeicoamento", "2023-07-01")).toBe(45);
    expect(percentualAH("altos2", "2025-12-12")).toBe(68);
    expect(tipoPeloPercentual(68, "2025-12-12")).toBe("altos2");
    expect(tipoPeloPercentual(45, "2021-04-23")).toBe("aperfeicoamento");
  });

  it("Maj Couto (64300.000657/2026-12): 45% → 68% (CGAEM) em 12 DEZ 25, 20 dias, natalino e descontos de 13,5%", () => {
    const p = planoAdicHab({
      fichas: [ficha(2025, linha("NR0001", { ...todos(11088, 1, 3), ...todos(11587, 4) }), linha("NR0003", { ...todos(4989.6, 1, 3), ...todos(5214.15, 4) }), linha("NR0092", { 11: 7911.19 }))],
      inicio: "2025-12-12", fim: "2025-12-31", hoje, dataRequerimento: "2026-02-19",
      dados: { tipo: "altos2", percentualPedido: 68, mesesFerias: ["2025-12"] },
    });
    expect(p.categoria).toBe("maj");
    expect(p.meses[0]!.diferenca).toBe(1719.36); // 23% × 11.587 × 20/31
    expect(soma(p.devidos[RUBRICA_NATAL])).toBe(2665.01); // diferença cheia de dezembro × 12/12
    expect(soma(p.devidos[RUBRICA_FERIAS])).toBe(888.34); // 1/3, com o mês de férias informado pelo operador
    expect(soma(p.devidos[RUBRICA_FUSEX]) + soma(p.devidos[RUBRICA_PMIL])).toBeCloseTo(232.11, 1); // 3% + 10,5%
    expect(p.alertas.map((a) => a.codigo)).not.toContain("PERCENTUAL_PEDIDO");
  });

  it("2º Ten Mulatinho (64592.002508/2026-50): 12% → 45% (residência) de 03 AGO a 31 DEZ 23", () => {
    const p = planoAdicHab({
      fichas: [ficha(2023, linha("NR0001", todos(7315, 7)), linha("NR0003", todos(877.8, 7)))],
      inicio: "2023-08-03", fim: "2023-12-31", hoje, dataRequerimento: "2025-05-29", dados: { tipo: "aperfeicoamento", percentualPedido: 45 },
    });
    expect(p.categoria).toBe("asp");
    expect(p.meses.map((m) => m.diferenca)).toEqual([2258.21, 2413.95, 2413.95, 2413.95, 2413.95]); // ago: 33% × 7.315 × 29/31
    expect(p.natalino).toEqual([expect.objectContaining({ ano: 2023, diferenca: 2413.95, avosSugeridos: 6, valor: 1206.98 })]); // 6 meses de serviço
  });

  it("2º Sgt Quinebre (64036.002843/2026-63): aperfeiçoamento pela tabela da lei, não 45% desde 2021; alerta", () => {
    const fichas = [2021, 2022, 2023, 2024, 2025].map((ano) => ficha(ano,
      linha("NR0001", ano < 2024 ? todos(3825) : ano === 2024 ? { ...todos(3825, 1, 5), ...todos(4770, 6) } : { ...todos(4770, 1, 3), ...todos(4985, 4) }),
      linha("NR0003", ano < 2024 ? todos(459) : ano === 2024 ? { ...todos(459, 1, 5), ...todos(572.4, 6) } : { ...todos(572.4, 1, 3), ...todos(598.2, 4) })));
    const p = planoAdicHab({
      fichas, inicio: "2021-04-23", fim: "2025-12-31", hoje, dataRequerimento: "2026-03-17",
      dados: { tipo: "aperfeicoamento", percentualPedido: 45, postos: [{ desde: "2021-04-23", categoria: "3-sgt" }, { desde: "2024-06-01", categoria: "2-sgt" }] },
    });
    const mes = (a: number, m: number) => p.meses.find((x) => x.ano === a && x.mes === m)!;
    expect(mes(2021, 5).devido).toBe(1032.75); // 27%
    expect(mes(2021, 7).devido).toBe(1300.5); // 34%
    expect(mes(2022, 7).devido).toBe(1568.25); // 41%
    expect(mes(2023, 7).devido).toBe(1721.25); // 45%
    expect(mes(2024, 6).devido).toBe(2146.5); // 45% de 2º Sgt (4.770,00)
    expect(p.alertas.map((a) => a.codigo)).toContain("PERCENTUAL_PEDIDO");
  });

  it("rubricas: receitas na 1ª receita vazia; Z01 e Z02 nas que já existem", () => {
    const rub = [
      ...Array.from({ length: 12 }, (_, i) => ({ posicao: i + 1, codigo: "", tipo: "Receita" })),
      { posicao: 13, codigo: "Z01 - FUSEX", tipo: "Despesa" }, { posicao: 14, codigo: "Z02 - P MIL 7,5/9,5/10,5%", tipo: "Despesa" },
    ];
    const r = rubricasAdicHab(rub, [RUBRICA_ADIC_HAB, RUBRICA_NATAL, RUBRICA_FUSEX, RUBRICA_PMIL]);
    expect(r.posicoes).toEqual({ [RUBRICA_ADIC_HAB]: 1, [RUBRICA_NATAL]: 2, [RUBRICA_FUSEX]: 13, [RUBRICA_PMIL]: 14 });
  });
});
