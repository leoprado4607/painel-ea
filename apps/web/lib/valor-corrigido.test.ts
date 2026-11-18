import type { IndiceMensal } from "@painel-ea/engine";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buscarTodas } from "./buscar-todas";
import { valoresCorrigidos } from "./valor-corrigido";

const indices = (JSON.parse(readFileSync(join(__dirname, "..", "..", "..", "packages", "engine", "test", "golden", "indices-planilha.json"), "utf-8")) as IndiceMensal[])
  .filter((i) => i.percentual !== null);

type Linha = Record<string, unknown>;
/** Banco falso que, como o Supabase, devolve no máximo 1.000 linhas por consulta. */
function bancoFalso(tabelas: Record<string, object[]>) {
  return {
    from(t: string) {
      let ids: unknown[] | null = null, de = 0, ate = 999;
      const q = {
        select: () => q,
        in: (_: string, v: unknown[]) => ((ids = v), q),
        order: () => q,
        range: (a: number, b: number) => ((de = a), (ate = b), q),
        then: (ok: (r: unknown) => unknown) => {
          const linhas = ((tabelas[t] ?? []) as Linha[]).filter((l) => !ids || ids.includes(l.processo_id));
          return Promise.resolve({ data: linhas.slice(de, Math.min(ate + 1, de + 1000)), error: null }).then(ok);
        },
      };
      return q;
    },
  };
}

it("valor corrigido do card: rascunho com os índices atuais, emitido com os da emissão, sem período '—'", async () => {
  const rubricas = ["a", "b", "c"].map((id) => ({ processo_id: id, posicao: 1, codigo: "A56 - AUX FARD 1 SOLDO", tipo: "Receita" }));
  const lancamentos = ["a", "b", "c"].flatMap((id) => [
    { processo_id: id, tipo: "devido", ano: 2021, mes: 6, posicao: 1, valor: "5483.00" },
    { processo_id: id, tipo: "recebido", ano: 2021, mes: 6, posicao: 1, valor: "713.00" },
  ]);
  const semCorrecao = indices.map((i) => ({ ...i, percentual: 0 }));
  const v = await valoresCorrigidos(bancoFalso({ processo_rubrica: rubricas, lancamento: lancamentos, indice_composto: indices }) as never, [
    { id: "a", situacao: "rascunho", periodo_inicio: "2021-06-01", periodo_fim: "2021-06-01" },
    { id: "b", situacao: "emitido", periodo_inicio: "2021-06-01", periodo_fim: "2021-06-01", indices_usados: semCorrecao },
    { id: "c", situacao: "rascunho", periodo_inicio: null, periodo_fim: null },
  ]);
  expect(v.get("a")).toBe(6389.41); // caso real do Sandro, com o período corrigido
  expect(v.get("b")).toBe(4770);    // índices guardados na emissão (aqui, zerados)
  expect(v.get("c")).toBeNull();
});

describe("valor do card com mais de 1.000 lançamentos", () => {
  it("busca todas as páginas", async () => {
    const dados = Array.from({ length: 2500 }, (_, i) => i);
    const r = await buscarTodas<number>((de, ate) => Promise.resolve({ data: dados.slice(de, ate + 1), error: null }));
    expect(r).toHaveLength(2500);
  });

  it("não perde os lançamentos do último processo", async () => {
    const proc = (id: string) => ({ id, situacao: "rascunho", periodo_inicio: "2022-01-01", periodo_fim: "2022-12-31" });
    const rub = (id: string) => ({ processo_id: id, posicao: 1, codigo: "AGA - COMPL SAL MIN", tipo: "Receita" });
    const lancamento = [
      ...Array.from({ length: 1000 }, () => ({ processo_id: "A", tipo: "devido", ano: 2022, mes: 1, posicao: 1, valor: 1 })),
      { processo_id: "B", tipo: "devido", ano: 2022, mes: 3, posicao: 1, valor: 80.1 },
    ];
    const r = await valoresCorrigidos(bancoFalso({
      processo_rubrica: [rub("A"), rub("B")], lancamento, indice_composto: [{ ano: 2022, mes: 1, percentual: 0 }],
    }) as never, [proc("A"), proc("B")]);
    expect(r.get("B")).toBe(80.1);
  });

  it("erro na busca: o card fica sem valor", async () => {
    const banco = { from: () => { const q = { select: () => q, in: () => q, order: () => q, range: () => q,
      then: (ok: (r: unknown) => unknown) => Promise.resolve({ data: null, error: { message: "falha" } }).then(ok) }; return q; } };
    const r = await valoresCorrigidos(banco as never, [{ id: "A", situacao: "rascunho", periodo_inicio: "2022-01-01", periodo_fim: "2022-12-31" }]);
    expect(r.get("A")).toBeUndefined();
  });
});
