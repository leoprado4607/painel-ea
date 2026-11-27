import { describe, expect, it } from "vitest";
import { complSalMinAutomatico, documentosComplSalMin, DOCUMENTO_COMPL_SAL_MIN, explicacaoComplSalMin, planoComplSalMin, rubricasComplSalMin, RUBRICA_AGA, RUBRICA_GR } from "./compl-sal-min";
import type { FichaLida } from "./receitas";

/** meses: { 5: 10 } → maio = 10 */
const linha = (codigo: string, meses: Record<number, number>) =>
  ({ codigo, descricao: codigo, meses: Array.from({ length: 12 }, (_, i) => meses[i + 1] ?? 0) });
const ficha = (ano: number, ...linhas: ReturnType<typeof linha>[]): FichaLida => ({ ano, sistema: "sippes", linhas });

describe("complemento de salário mínimo automático", () => {
  it("só com a espécie e nos processos criados depois da mudança", () => {
    const especie_divida = "Complemento de salário mínimo";
    expect(complSalMinAutomatico({ especie_divida, complementos: { calculoAutomatico: true } })).toBe(true);
    expect(complSalMinAutomatico({ especie_divida, complementos: {} })).toBe(false); // rascunhos e emitidos antigos
    expect(complSalMinAutomatico({ especie_divida: "Auxílio Transporte", complementos: { calculoAutomatico: true } })).toBe(false);
  });

  it("recebidos no período, após o período (antes é desconsiderado) e devidos com a gratificação abatida", () => {
    const fichas = [
      ficha(2022, linha("AR0026", { 1: 5, 3: 20 }), linha("AR0061", { 1: 9, 3: 30, 4: 80.1, 5: 100 }), linha("NR0001", { 3: 1000 })),
      ficha(2023, linha("AR0026", { 2: 15 })),
      ficha(2024, linha("AGA", { 1: 170.1 })),
    ];
    const p = planoComplSalMin(fichas, "2022-03-01", "2023-01-31");
    expect(p.aga).toEqual([{ ano: 2022, mes: 3, valor: 20 }]); // jan/2022 é antes do período
    expect(p.gr).toEqual([{ ano: 2022, mes: 3, valor: 30 }]); // abr e mai não computados: a AR0061 também não é lançada
    expect(p.posPeriodo).toEqual([{ ano: 2023, mes: 2, valor: 15 }, { ano: 2024, mes: 1, valor: 170.1 }]);
    // mar: 80,10 cheio (a AR0061, Receita, é descontada no cálculo); abr e mai: gratificação igual ou maior, não
    // computados; jun a dez: 80,10; jan/2023: 170,10
    expect(p.devidos[0]).toEqual({ ano: 2022, mes: 3, valor: 80.1 });
    expect(p.devidos.find((d) => d.mes === 4 && d.ano === 2022)).toBeUndefined();
    expect(p.devidos.find((d) => d.mes === 5 && d.ano === 2022)).toBeUndefined();
    expect(p.devidos.filter((d) => d.ano === 2022 && d.mes >= 6).every((d) => d.valor === 80.1)).toBe(true);
    expect(p.devidos.at(-1)).toEqual({ ano: 2023, mes: 1, valor: 170.1 });
    expect(p.devidos).toHaveLength(9);
    expect(p.notas["2022-3"]).toContain("R$ 80,10 − R$ 30,00 = R$ 50,10");
    expect(p.notas["2022-4"]).toContain("Mês não computado");
    expect(p.notas["2022-6"]).toBeUndefined();
  });

  it("não há complemento fora de 2022 e 2023", () => {
    expect(planoComplSalMin([], "2021-11-01", "2024-02-29").devidos.map((d) => d.ano))
      .toEqual([...Array(12).fill(2022), ...Array(12).fill(2023)]);
  });

  it("gratificação em mês sem complemento (2021) não é lançada", () => {
    const fichas = [ficha(2021, linha("AR0061", { 12: 21 }))];
    const p = planoComplSalMin(fichas, "2021-03-01", "2022-01-14");
    expect(p.gr).toEqual([]);
    expect(p.devidos).toEqual([{ ano: 2022, mes: 1, valor: 36.17 }]); // 80,10 ÷ 31 × 14
  });

  it("início e fim incompletos: proporcional aos dias do mês no calendário; a gratificação é abatida depois", () => {
    const fichas = [ficha(2022, linha("AR0061", { 2: 10 })), ficha(2023, linha("AR0061", { 2: 100 }))];
    const p = planoComplSalMin(fichas, "2022-02-15", "2023-02-14");
    // fev/2022: 80,10 ÷ 28 × 14 = 40,05 (a AR0061 de 10 é descontada no cálculo); fev/2023: 170,10 ÷ 28 × 14 = 85,05 ≤ 100,
    // não computado (nem devido nem AR0061)
    expect(p.devidos[0]).toEqual({ ano: 2022, mes: 2, valor: 40.05 });
    expect(p.gr).toEqual([{ ano: 2022, mes: 2, valor: 10 }]);
    expect(p.devidos[1]).toEqual({ ano: 2022, mes: 3, valor: 80.1 });
    expect(p.devidos.at(-1)).toEqual({ ano: 2023, mes: 1, valor: 170.1 });
    expect(p.notas["2022-2"]).toBe("Valor proporcional: R$ 80,10 ÷ 28 dias × 14 dia(s) no período = R$ 40,05. "
      + "Abatida a AR0061 / GRAT REPRESENT EVENTUAL recebida (Receita): R$ 40,05 − R$ 10,00 = R$ 30,05.");
    expect(p.notas["2023-2"]).toContain("Mês não computado");
    // 31 dias: de 10/03 a 31/03 são 22 dias → 80,10 ÷ 31 × 22 = 56,845 → 56,85 (o valor do dia não é arredondado)
    expect(planoComplSalMin([], "2022-03-10", "2022-03-31").devidos).toEqual([{ ano: 2022, mes: 3, valor: 56.85 }]);
  });

  it("AGA na posição 1 e AR0061 (Receita) à direita, só se houver gratificação", () => {
    const vazias = Array.from({ length: 17 }, (_, i) => ({ posicao: i + 1, codigo: i >= 12 ? "Z01 - FUSEX" : "", tipo: i >= 12 ? "Despesa" : "Receita" }));
    const sem = rubricasComplSalMin(vazias, false);
    expect(sem.mudadas).toEqual([{ posicao: 1, codigo: RUBRICA_AGA, tipo: "Receita" }]);
    expect(sem.posicaoGr).toBeNull();
    const com = rubricasComplSalMin(vazias, true);
    expect(com.mudadas).toEqual([{ posicao: 1, codigo: RUBRICA_AGA, tipo: "Receita" }, { posicao: 2, codigo: RUBRICA_GR, tipo: "Receita" }]);
    // já escolhidas: nada muda
    const prontas = vazias.map((r) => (r.posicao === 1 ? { ...r, codigo: RUBRICA_AGA } : r.posicao === 2 ? { ...r, codigo: RUBRICA_GR } : r));
    expect(rubricasComplSalMin(prontas, true)).toEqual({ mudadas: [], posicaoAga: 1, posicaoGr: 2 });
  });
});

describe("verso do complemento de salário mínimo", () => {
  it("explicação com o ano do requerimento e o período da dívida", () => {
    const t = explicacaoComplSalMin("2023-06-10", "2022-03-01", "2023-02-17");
    expect(t).toContain("solicitou em 2023 os valores");
    expect(t).toContain("no período de 1º MAR 22 a 17 FEV 23 e o valor");
    expect(explicacaoComplSalMin("2023-06-10", "2022-05-15", "2022-05-31")).toContain("15 MAIO 22 a 31 MAIO 22");
  });
  it("DIEx da base de cálculo fixo como 2º documento, sem repetir", () => {
    expect(documentosComplSalMin(["BI 1"])).toEqual(["BI 1", DOCUMENTO_COMPL_SAL_MIN]);
    expect(documentosComplSalMin(["BI 1", DOCUMENTO_COMPL_SAL_MIN, "BI 2"])).toEqual(["BI 1", DOCUMENTO_COMPL_SAL_MIN, "BI 2"]);
  });
});
