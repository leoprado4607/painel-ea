import { describe, expect, it } from "vitest";
import { lerReais, formatarReais } from "./dinheiro";
import {
  anosDoPeriodo, copiarMes, definirValor, diferencas, gradeDeLinhas, linhasDaGrade, mesesDoPeriodo, repetirAte, totalDoMes,
} from "./lancamentos";

describe("período", () => {
  it("lista meses e anos, atravessando a virada do ano", () => {
    expect(mesesDoPeriodo({ ano: 2020, mes: 11 }, { ano: 2021, mes: 2 })).toEqual([
      { ano: 2020, mes: 11 }, { ano: 2020, mes: 12 }, { ano: 2021, mes: 1 }, { ano: 2021, mes: 2 },
    ]);
    expect(anosDoPeriodo({ ano: 2019, mes: 5 }, { ano: 2021, mes: 1 })).toEqual([2019, 2020, 2021]);
  });
});

describe("edição dos valores", () => {
  const base = gradeDeLinhas([{ ano: 2020, mes: 1, posicao: 1, valor: 5000 }, { ano: 2020, mes: 1, posicao: 13, valor: 150 }]);

  it("copiar do mês anterior", () => {
    expect(copiarMes(base, { ano: 2020, mes: 1 }, { ano: 2020, mes: 2 })[2020]![2]).toEqual({ 1: 5000, 13: 150 });
  });
  it("repetir até dezembro sem alterar o original", () => {
    const g = repetirAte(base, { ano: 2020, mes: 1 }, { ano: 2020, mes: 12 });
    expect(linhasDaGrade(g)).toHaveLength(24);
    expect(linhasDaGrade(base)).toHaveLength(2);
  });
  it("valor vazio ou zero remove a linha", () => {
    expect(definirValor(base, { ano: 2020, mes: 1 }, 13, null)[2020]![1]).toEqual({ 1: 5000 });
  });
  it("total do mês: receitas − despesas, ignorando posição sem código e tipo '-'", () => {
    const rub = [
      { posicao: 1, codigo: "A01 - SOLDO", tipo: "Receita" as const },
      { posicao: 9, codigo: "B03", tipo: "-" as const },
      { posicao: 10, codigo: "", tipo: "Receita" as const },
      { posicao: 13, codigo: "Z01 - FUSEX", tipo: "Despesa" as const },
    ];
    expect(totalDoMes({ 1: 5000, 9: 999, 10: 1, 13: 150.1 }, rub)).toBe(4849.9);
  });
  it("diferenças para gravar", () => {
    const original = linhasDaGrade(base);
    const atual = linhasDaGrade(definirValor(definirValor(base, { ano: 2020, mes: 1 }, 1, 5100), { ano: 2020, mes: 1 }, 13, null));
    expect(diferencas(original, atual)).toEqual({
      gravar: [{ ano: 2020, mes: 1, posicao: 1, valor: 5100 }],
      apagar: [{ ano: 2020, mes: 1, posicao: 13 }],
    });
  });
});

describe("reais", () => {
  it.each([["1.234,56", 1234.56], ["1234,5", 1234.5], ["1234.50", 1234.5], ["R$ 10", 10], ["", null]])("lerReais(%s)", (t, v) =>
    expect(lerReais(t as string)).toBe(v));
  it("recusa texto inválido", () => expect(lerReais("12,345")).toBeNaN());
  it("formata", () => expect(formatarReais(1234.5)).toBe("1.234,50"));
});
