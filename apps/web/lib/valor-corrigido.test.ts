import type { IndiceMensal } from "@painel-ea/engine";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { valoresCorrigidos } from "./valor-corrigido";

const indices = (JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "packages", "engine", "test", "golden", "indices-planilha.json"), "utf-8")) as IndiceMensal[])
  .filter((i) => i.percentual !== null);

/** Banco simulado: from(tabela).select().in() devolve as linhas da tabela. */
function banco(tabelas: Record<string, unknown[]>) {
  const consulta = (linhas: unknown[]) => {
    const p = Promise.resolve({ data: linhas });
    return Object.assign(p, { in: () => Promise.resolve({ data: linhas }) });
  };
  return { from: (t: string) => ({ select: () => consulta(tabelas[t] ?? []) }) } as never;
}

it("valor corrigido do card: rascunho com os índices atuais, emitido com os da emissão, sem período '—'", async () => {
  const rubricas = ["a", "b", "c"].map((id) => ({ processo_id: id, posicao: 1, codigo: "A56 - AUX FARD 1 SOLDO", tipo: "Receita" }));
  const lancamentos = ["a", "b", "c"].flatMap((id) => [
    { processo_id: id, tipo: "devido", ano: 2021, mes: 6, posicao: 1, valor: "5483.00" },
    { processo_id: id, tipo: "recebido", ano: 2021, mes: 6, posicao: 1, valor: "713.00" },
  ]);
  const semCorrecao = indices.map((i) => ({ ...i, percentual: 0 }));
  const v = await valoresCorrigidos(banco({ processo_rubrica: rubricas, lancamento: lancamentos, indice_composto: indices }), [
    { id: "a", situacao: "rascunho", periodo_inicio: "2021-06-01", periodo_fim: "2021-06-01" },
    { id: "b", situacao: "emitido", periodo_inicio: "2021-06-01", periodo_fim: "2021-06-01", indices_usados: semCorrecao },
    { id: "c", situacao: "rascunho", periodo_inicio: null, periodo_fim: null },
  ]);
  expect(v.get("a")).toBe(6389.41); // caso real do Sandro, com o período corrigido
  expect(v.get("b")).toBe(4770);    // índices guardados na emissão (aqui, zerados)
  expect(v.get("c")).toBeNull();
});
