/** preencherReceitas no complemento de salário mínimo, com um banco em memória (só o que a função usa). */
import { describe, expect, it } from "vitest";
import { preencherReceitas } from "./receitas";

type Linha = Record<string, unknown>;
const CHAVES: Record<string, string[]> = {
  lancamento: ["processo_id", "tipo", "ano", "mes", "posicao"], processo_rubrica: ["processo_id", "posicao"], processo: ["id"],
};

function bancoFalso(tabelas: Record<string, Linha[]>) {
  const casa = (l: Linha, f: Linha) => Object.entries(f).every(([k, v]) => l[k] === v);
  return {
    from(t: string) {
      const linhas = (tabelas[t] ??= []);
      let filtro: Linha = {};
      let acao: "select" | "delete" | "update" = "select";
      let dados: Linha = {};
      let de = 0, ate = Infinity;
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => ((filtro = { ...filtro, [k]: v }), q),
        match: (f: Linha) => ((filtro = { ...filtro, ...f }), q),
        order: () => q,
        range: (a: number, b: number) => ((de = a), (ate = b), q),
        delete: () => ((acao = "delete"), q),
        update: (d: Linha) => ((acao = "update"), (dados = d), q),
        upsert: (novas: Linha[]) => {
          for (const n of novas) {
            const i = linhas.findIndex((l) => CHAVES[t]!.every((k) => l[k] === n[k]));
            if (i >= 0) linhas[i] = { ...linhas[i], ...n }; else linhas.push(n);
          }
          return Promise.resolve({ error: null });
        },
        maybeSingle: () => Promise.resolve({ data: linhas.find((l) => casa(l, filtro)) ?? null }),
        then: (ok: (r: unknown) => unknown) => {
          if (acao === "delete") tabelas[t] = linhas.filter((l) => !casa(l, filtro));
          if (acao === "update") linhas.filter((l) => casa(l, filtro)).forEach((l) => Object.assign(l, dados));
          return Promise.resolve(acao === "select" ? { data: linhas.filter((l) => casa(l, filtro)).slice(de, ate + 1), error: null } : { error: null }).then(ok);
        },
      };
      return q;
    },
  };
}

const meses = (m: Record<number, number>) => Array.from({ length: 12 }, (_, i) => m[i + 1] ?? 0);
const rubricas = () => Array.from({ length: 17 }, (_, i) => ({
  processo_id: "P", posicao: i + 1, codigo: i >= 12 ? "Z01 - FUSEX" : "", tipo: i >= 12 ? "Despesa" : "Receita",
}));
const processo = (complementos: Linha) => ({
  id: "P", situacao: "rascunho", periodo_inicio: "2022-03-01", periodo_fim: "2022-12-31",
  especie_divida: "Complemento de salário mínimo", complementos,
  fichas_lidas: [
    { ano: 2022, sistema: "sippes", linhas: [
      { codigo: "AR0026", descricao: "COMPLEMENTO SALARIO MINIMO", meses: meses({ 3: 20 }) },
      { codigo: "AR0061", descricao: "GRAT REPRESENT EVENTUAL", meses: meses({ 3: 30, 4: 90 }) },
    ] },
    { ano: 2023, sistema: "sippes", linhas: [{ codigo: "AR0026", descricao: "COMPLEMENTO SALARIO MINIMO", meses: meses({ 1: 170.1 }) }] },
  ],
});

describe("preencherReceitas no complemento de salário mínimo", () => {
  it("processo novo: rubricas, recebidos, recebido após o período e devidos; o digitado fica", async () => {
    const t: Record<string, Linha[]> = {
      processo: [processo({ calculoAutomatico: true })], processo_rubrica: rubricas(),
      lancamento: [{ processo_id: "P", tipo: "devido", ano: 2022, mes: 12, posicao: 1, valor: 1, origem: "digitado" }],
    };
    await preencherReceitas(bancoFalso(t) as never, "P");
    expect(t.processo_rubrica!.slice(0, 3).map((r) => [r.codigo, r.tipo]))
      .toEqual([["AGA - COMPL SAL MIN", "Receita"], ["AR0061 - GRAT REPRESENT EVENTUAL", "Receita"], ["", "Receita"]]);
    const de = (tipo: string) => t.lancamento!.filter((l) => l.tipo === tipo).map((l) => `${l.mes}/${l.posicao}=${l.valor}`).sort();
    expect(de("recebido")).toEqual(["3/1=20", "3/2=30"]); // abr (AR0061 90 ≥ 80,10) não computado
    // mar: 80,10 cheio (a AR0061 é descontada no cálculo); abr não computado; mai a nov: 80,10; dez: o digitado (1) fica
    expect(de("devido")).toEqual(["3/1=80.1", ...[5, 6, 7, 8, 9, 10, 11].map((m) => `${m}/1=80.1`), "12/1=1"].sort());
    expect((t.processo![0]!.complementos as Linha).recebidosPosPeriodo).toEqual([{ ano: 2023, mes: 1, posicao: 1, valor: 170.1 }]);
  });

  it("processo antigo (sem a marca): nada muda além das receitas de sempre", async () => {
    const t: Record<string, Linha[]> = { processo: [processo({})], processo_rubrica: rubricas(), lancamento: [], correspondencia_rubrica: [] };
    await preencherReceitas(bancoFalso(t) as never, "P");
    expect(t.processo_rubrica!.every((r) => r.codigo === "" || r.codigo === "Z01 - FUSEX")).toBe(true);
    expect(t.lancamento).toEqual([]);
    expect(t.processo![0]!.complementos).toEqual({});
  });
});

describe("leitura dos lançamentos acima de 1.000 linhas", () => {
  it("um valor digitado depois da milésima linha continua protegido", async () => {
    // banco que devolve no máximo 1.000 linhas por consulta
    const limitar = (b: ReturnType<typeof bancoFalso>) => ({
      from: (t: string) => {
        const q = b.from(t) as unknown as { range: (de: number, ate: number) => unknown };
        const range = q.range;
        q.range = (de, ate) => range(de, Math.min(ate, de + 999));
        return q;
      },
    });
    const enchimento = Array.from({ length: 1000 }, (_, i) => ({
      processo_id: "P", tipo: "recebido", ano: 2010, mes: 1, posicao: 100 + i, valor: 1, origem: "digitado",
    }));
    const t: Record<string, Linha[]> = {
      processo: [processo({ calculoAutomatico: true })], processo_rubrica: rubricas(),
      lancamento: [...enchimento, { processo_id: "P", tipo: "recebido", ano: 2022, mes: 3, posicao: 1, valor: 7, origem: "digitado" }],
    };
    await preencherReceitas(limitar(bancoFalso(t)) as never, "P");
    expect(t.lancamento!.find((l) => l.tipo === "recebido" && l.ano === 2022 && l.mes === 3 && l.posicao === 1)).toMatchObject({ valor: 7, origem: "digitado" });
  });
});
