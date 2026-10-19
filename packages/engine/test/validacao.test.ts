import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arredondar, cpfValido, identidadeValida, precCpValido, quantidadeMeses } from "../src";

const golden = JSON.parse(readFileSync(join(__dirname, "golden", "validacoes.json"), "utf-8").replace(/^﻿/, "")) as {
  precCp: { valor: number; resultado: string }[];
  cpf: { valor: string; resultado: string }[];
};

describe("validações iguais às da planilha (resultado OK/Erro calculado pelo Excel)", () => {
  it.each(golden.precCp.map((c) => [c.valor, c.resultado]))("Prec-CP %s → %s", (valor, resultado) => {
    expect(precCpValido(valor as number) ? "OK" : "Erro").toBe(resultado);
  });
  it.each(golden.cpf.map((c) => [c.valor, c.resultado]))("CPF %s → %s", (valor, resultado) => {
    expect(cpfValido(valor as string) ? "OK" : "Erro").toBe(resultado);
  });
  it("a amostra tem casos OK e Erro", () => {
    expect(golden.cpf.some((c) => c.resultado === "OK")).toBe(true);
    expect(golden.cpf.some((c) => c.resultado === "Erro")).toBe(true);
  });
});

describe("identidade militar (regra inferida; na planilha a fórmula está quebrada)", () => {
  it("aceita dígito que completa a dezena e recusa o resto", () => {
    // 123456789: pesos 2,1,2,… → 2,2,6,4,1+0,6,1+4,8,1+8 = 43 → dígito 7
    expect(identidadeValida("123.456.789-7")).toBe(true);
    expect(identidadeValida("123.456.789-8")).toBe(false);
  });
});

describe("arredondamento estilo Excel", () => {
  it.each([[1.005, 2, 1.01], [2.675, 2, 2.68], [-1.005, 2, -1.01], [0.0000045, 6, 0.000005], [8605.175, 2, 8605.18], [12.3449999, 2, 12.34]])(
    "arredondar(%s, %s) = %s", (x, casas, r) => expect(arredondar(x, casas)).toBe(r));
});

it("quantidade de meses (Informações!H32)", () => {
  expect(quantidadeMeses({ ano: 2016, mes: 1 }, { ano: 2026, mes: 9 })).toBe(129);
  expect(quantidadeMeses({ ano: 2020, mes: 1 }, { ano: 2020, mes: 12 })).toBe(12);
});
