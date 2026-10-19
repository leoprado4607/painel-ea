/**
 * Prova que entendemos todas as fórmulas: o avaliador recalcula a planilha inteira a partir só das
 * entradas de cada caso e precisa chegar aos mesmos valores que o Excel gravou.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EntradaCalculo } from "../src";
import { Planilha, type Formulas, type Golden } from "./avaliador";

const DIR = join(__dirname, "golden");
const ler = <T>(arq: string): T => JSON.parse(readFileSync(join(DIR, arq), "utf-8")) as T;
const formulas = ler<Formulas>("formulas.json");
export const CASOS = ["c01_simples", "c02_varios_anos", "c03_2006_2007", "c04_completo"];
const COLS = "DEFGHIJKLMNO";

export function entradasDoCaso(e: EntradaCalculo & { informacoes?: Record<string, unknown> }): Map<string, number> {
  const m = new Map<string, number>();
  for (const [cel, v] of Object.entries(e.informacoes ?? {})) if (typeof v === "number") m.set(`Informações!${cel}`, v);
  for (const [aba, lanc] of [["Contracheque - F Financeira", e.recebido], ["Lançar Valor Devido", e.devido]] as const) {
    for (const [ano, porPos] of Object.entries(lanc)) {
      for (const [pos, vals] of Object.entries(porPos)) {
        const linha = 5 + 19 * (Number(ano) - 2006) + Number(pos);
        vals.forEach((v, i) => { if (v !== null && v !== undefined) m.set(`${aba}!${COLS[i]}${linha}`, v); });
      }
    }
  }
  return m;
}

describe.each(CASOS)("emulação da planilha: %s", (nome) => {
  it("recalcula todas as células numéricas igual ao Excel", () => {
    const entrada = ler<EntradaCalculo>(`${nome}.entrada.json`);
    const golden = ler<Golden>(`${nome}.json`);
    const p = new Planilha(formulas, golden, entradasDoCaso(entrada), entrada.rubricas.map((r) => r.codigo));
    const erros: string[] = [];
    let n = 0;
    for (const [aba, cels] of Object.entries(golden)) {
      if (aba === "Informações") continue; // validações de documento: testadas em validacao.test.ts
      for (const [ref, g] of Object.entries(cels)) {
        if (typeof g !== "number") continue;
        n++;
        let v: unknown;
        try { v = p.valor(aba, ref); } catch (err) { v = `ERRO ${(err as Error).message}`; }
        if (typeof v !== "number" || Math.abs(v - g) > 1e-9 * Math.max(1, Math.abs(g))) erros.push(`${aba}!${ref}: avaliador=${v} excel=${g}`);
      }
    }
    expect(erros.slice(0, 30), `${erros.length} de ${n} células diferentes`).toEqual([]);
    expect(n).toBeGreaterThan(40000);
  });
});
