import { calcular, type EntradaCalculo, type IndiceMensal } from "@painel-ea/engine";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { montarEntrada } from "./calculo";

const GOLDEN = join(__dirname, "..", "..", "..", "packages", "engine", "test", "golden");
const ler = <T>(a: string) => JSON.parse(readFileSync(join(GOLDEN, a), "utf-8")) as T;

it("entrada montada a partir das linhas do banco dá o mesmo resultado do caso de teste", () => {
  for (const nome of ["c02_varios_anos", "c04_completo"]) {
    const caso = ler<EntradaCalculo>(`${nome}.entrada.json`);
    const indices = ler<IndiceMensal[]>("indices-planilha.json");
    const linhas = (["recebido", "devido"] as const).flatMap((tipo) =>
      Object.entries(caso[tipo]).flatMap(([ano, porPos]) =>
        Object.entries(porPos).flatMap(([pos, vals]) =>
          vals.flatMap((v, i) => (v ? [{ tipo, ano: +ano, mes: i + 1, posicao: +pos, valor: v }] : [])))));
    const rubricas = caso.rubricas.map((r, i) => ({ posicao: i + 1, ...r }));
    const doBanco = montarEntrada(rubricas, linhas, indices.filter((i) => i.percentual !== null) as { ano: number; mes: number; percentual: number }[]);
    const esperado = calcular({ ...caso, indices });
    const obtido = calcular(doBanco);
    expect(obtido.cpex).toEqual(esperado.cpex);
    expect(obtido.recapitulacao).toEqual(esperado.recapitulacao);
    expect(obtido.porAno[2016]!.verso).toEqual(esperado.porAno[2016]!.verso);
  }
});
