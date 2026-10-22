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
    const esperado = calcular({ ...caso, indices, arredondamento: "total" }); // o sistema arredonda só os totais
    const obtido = calcular(doBanco);
    expect(obtido.cpex).toEqual(esperado.cpex);
    expect(obtido.recapitulacao).toEqual(esperado.recapitulacao);
    expect(obtido.porAno[2016]!.verso).toEqual(esperado.porAno[2016]!.verso);
  }
});

it("só os lançamentos do período da dívida entram no cálculo (caso real: período corrigido de 06/2026 para 06/2021)", () => {
  const indices = ler<IndiceMensal[]>("indices-planilha.json").filter((i) => i.percentual !== null) as { ano: number; mes: number; percentual: number }[];
  const rubricas = [{ posicao: 1, codigo: "A56 - AUX FARD 1 SOLDO", tipo: "Receita" as const }];
  const linhas = [2026, 2021].flatMap((ano) => [
    { tipo: "devido" as const, ano, mes: 6, posicao: 1, valor: 5483 }, { tipo: "recebido" as const, ano, mes: 6, posicao: 1, valor: 713 },
  ]);
  const total = (inicio: string, fim: string) => calcular(montarEntrada(rubricas, linhas, indices, { inicio, fim })).cpex.importanciaBasicaTotalCorrigida;
  expect(total("2026-06-01", "2026-06-01")).toBe(4806.67); // o que saiu com o período errado
  expect(total("2021-06-01", "2021-06-01")).toBe(6389.41); // período certo: os valores de 2026 não somam
});

it("recebidos após o período entram no cálculo como recebidos do mês do pagamento (os de dentro do período, não)", () => {
  const indices = ler<IndiceMensal[]>("indices-planilha.json").filter((i) => i.percentual !== null) as { ano: number; mes: number; percentual: number }[];
  const rubricas = [{ posicao: 1, codigo: "A56 - AUX FARD 1 SOLDO", tipo: "Receita" as const }];
  const linhas = [{ tipo: "devido" as const, ano: 2021, mes: 6, posicao: 1, valor: 5483 }];
  const periodo = { inicio: "2021-06-01", fim: "2021-06-01" };
  const sem = calcular(montarEntrada(rubricas, linhas, indices, periodo));
  const com = calcular(montarEntrada(rubricas, linhas, indices, {
    ...periodo, posPeriodo: [{ ano: 2022, mes: 3, posicao: 1, valor: 1000 }, { ano: 2021, mes: 6, posicao: 1, valor: 999 }],
  }));
  const corrigido2022 = com.porAno[2022]!.recebidoCorrigido[0]![2]!;
  expect(com.porAno[2022]!.recebido[0]![2]).toBe(1000);
  expect(com.porAno[2021]!.recebido[0]![5]).toBe(0); // o de dentro do período é ignorado
  expect(corrigido2022).toBeGreaterThan(1000);
  expect(com.cpex.importanciaBasicaTotalCorrigida).toBeCloseTo(sem.cpex.importanciaBasicaTotalCorrigida - corrigido2022, 1);
});
