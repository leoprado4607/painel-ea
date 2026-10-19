/**
 * Compara o motor (regra de negócio) com a planilha original recalculada no Excel.
 * Cada caso fictício foi digitado numa cópia da planilha (tools/golden) e salvo em test/golden/<caso>.json.
 *
 * O motor calcula o CERTO. Onde a planilha tem erro de fórmula (seção "Problemas" do PLANO.md),
 * a diferença só é aceita dentro da região declarada em ERROS_DA_PLANILHA, e cada erro declarado
 * precisa aparecer em pelo menos um caso (para a lista não ficar desatualizada).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calcular, type EntradaCalculo, type IndiceMensal } from "../src";
import type { Formulas, Golden } from "./avaliador";
import { celulasEsperadas } from "./planilha";

const DIR = join(__dirname, "golden");
const ler = <T>(arq: string): T => JSON.parse(readFileSync(join(DIR, arq), "utf-8")) as T;
const indices = ler<IndiceMensal[]>("indices-planilha.json");
const formulas = ler<Formulas>("formulas.json");
const CASOS = ["c01_simples", "c02_varios_anos", "c03_2006_2007", "c04_completo"];

const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const partes = (ref: string) => ({ col: colNum(ref.replace(/\d+/g, "")), linha: Number(ref.replace(/\D+/g, "")) });
const dentro = (ref: string, c1: string, l1: number, c2: string, l2: number) => {
  const { col, linha } = partes(ref);
  return col >= colNum(c1) && col <= colNum(c2) && linha >= l1 && linha <= l2;
};
/** Linhas do Resumo do ano: bloco de 20 linhas, dois anos lado a lado (C:E e H:J). */
const resumo = (ref: string, ano: number, soTotal = false) => {
  const k = Math.floor((ano - 2006) / 2), lado = (ano - 2006) % 2, cab = 8 + 20 * k;
  const [c1, c2] = lado === 0 ? ["C", "E"] : ["H", "J"];
  return soTotal ? dentro(ref, c1, cab + 18, c2, cab + 18) : dentro(ref, c1, cab + 1, c2, cab + 18);
};

/** Erros de fórmula da planilha original: região onde a planilha mostra valor diferente da regra. */
const ERROS_DA_PLANILHA: Record<string, { descricao: string; regiao: (aba: string, ref: string) => boolean }> = {
  P1: {
    descricao: "Códigos-Anos soma linhas erradas em 2026 (recebido) e 2027–2028 (e X80); afeta os totais e a CPEX.",
    regiao: (aba, ref) =>
      (aba === "Códigos-Anos" && (dentro(ref, "W", 4, "Y", 81) || dentro(ref, "AA", 4, "AB", 81))) ||
      (aba === "CPEX" && (dentro(ref, "F", 13, "F", 33) || dentro(ref, "I", 16, "I", 33)) || aba === "CPEX" && ref === "C41"),
  },
  P9: {
    descricao: "Resumo: TOTAL LÍQUIDO de 2008 e 2011 mostra outro ano; 2016 e 2018 deslocados uma linha; a coluna de 2029 mostra 2025.",
    regiao: (aba, ref) => aba === "Resumo" &&
      ([2008, 2011].some((a) => resumo(ref, a, true)) || [2016, 2018, 2029].some((a) => resumo(ref, a))),
  },
  P10: {
    descricao: "06/07-Recebido e 06/07-Devido corrigem os valores de 2006/2007 com os índices de 2008.",
    regiao: (aba, ref) => /^0[67]-(Recebido|Devido)$/.test(aba) && ["E", "H", "K"].includes(ref.replace(/\d+/g, "")),
  },
  P11: {
    descricao: "Solicitação 06: coluna 'com correção' das rubricas 2–17 vem da Verso de 2007 (e o total e a importância básica).",
    regiao: (aba, ref) => aba === "Solicitação 06" && (dentro(ref, "E", 19, "E", 35) || ref === "D16"),
  },
  P12: {
    descricao: "Solicitação 06 Verso e 07 Verso: TOTAL corrigido (G32) vem do ano de 2008.",
    regiao: (aba, ref) => /^Solicitação 0[67] Verso$/.test(aba) && ref === "G32",
  },
  P14: {
    descricao: "F Financeira-Corrigida!D311 e 21-Recebido!F13: fevereiro/2021 da rubrica 6 lê o valor de julho; propaga para os totais de 2021, a CPEX e a Recapitulação.",
    regiao: (aba, ref) => {
      const { linha } = partes(ref);
      return (aba === "F Financeira-Corrigida" && linha >= 304 && linha <= 323) ||
        (aba === "Valor_Líquido_Corrigido" && linha >= 289 && linha <= 307) ||
        aba === "Solicitação 21 Verso" || aba === "Solicitação 21" || aba === "21-Recebido" ||
        (aba === "Códigos-Anos" && (dentro(ref, "R", 64, "R", 81) || dentro(ref, "AA", 64, "AB", 81))) ||
        (aba === "CPEX" && (dentro(ref, "I", 16, "I", 33) || ref === "F13" || ref === "C41")) ||
        (aba === "Solicitação Recapitulação" && (linha === 35 || linha === 43));
    },
  },
  P13: {
    descricao: "Solicitação 28 Verso: valores devidos e recebidos sem correção vêm do ano de 2027 (e o que depende deles na Solicitação 28 e no Resumo).",
    regiao: (aba, ref) =>
      (aba === "Solicitação 28 Verso" && dentro(ref, "D", 15, "F", 32)) ||
      (aba === "Solicitação 28" && dentro(ref, "D", 18, "D", 37)) ||
      (aba === "Resumo" && resumo(ref, 2028)),
  },
};

/** Células numéricas que só repetem dados cadastrais ou rótulos de ano: não são cálculo. */
function ehExibicao(aba: string, ref: string, valor: number): boolean {
  const f = formulas[aba]?.[ref]?.[0];
  if (typeof f !== "string") return true;
  const rotuloAno = Number.isInteger(valor) && valor >= 2000 && valor <= 2040 && /^=\$?[A-Z]+\$?\d+(\+1)?$/.test(f);
  return /Informações!/.test(f) || /^=Código\d+$/.test(f) || rotuloAno;
}

function layoutSolicitacao(ano: number) {
  const aba = `Solicitação ${String(ano % 100).padStart(2, "0")}`;
  const f = formulas[aba]!;
  const linha = (pred: (ref: string, v: string) => boolean) =>
    Number(Object.entries(f).find(([ref, [v]]) => typeof v === "string" && pred(ref, v))![0].replace(/\D+/g, ""));
  // 1ª linha da Verso: a menor linha da coluna E que soma uma linha do Contracheque.
  const primeiraLinhaVerso = Math.min(...Object.entries(formulas[`${aba} Verso`]!)
    .filter(([ref, [v]]) => ref.startsWith("E") && typeof v === "string" && v.startsWith("=SUM('Contracheque"))
    .map(([ref]) => Number(ref.slice(1))));
  return {
    primeiraLinhaVerso,
    primeiraLinha: linha((ref, v) => ref.startsWith("D") && new RegExp(`Verso'!F${primeiraLinhaVerso}$`).test(v)),
    linhaImportancia: linha((ref, v) => ref.startsWith("D") && v.startsWith("=ROUND(")),
  };
}

const iguais = (a: unknown, b: unknown) =>
  typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)) : a === b;

const errosEncontrados = new Map<string, number>();

describe.each(CASOS)("motor × planilha: %s", (nome) => {
  const entrada = { ...ler<EntradaCalculo>(`${nome}.entrada.json`), indices };
  const golden = ler<Golden>(`${nome}.json`);
  const esperado = celulasEsperadas(calcular(entrada), { layoutSolicitacao });

  it("bate com a planilha em todas as células, exceto nos erros conhecidos da planilha", () => {
    const inexplicadas: string[] = [];
    let comparadas = 0;
    for (const [chave, v] of esperado) {
      const [aba, ref] = chave.split("!") as [string, string];
      const g = golden[aba]?.[ref];
      if (g === undefined) { inexplicadas.push(`${chave}: mapeada para célula sem fórmula`); continue; }
      comparadas++;
      if (iguais(v, g)) continue;
      const erro = Object.entries(ERROS_DA_PLANILHA).find(([, e]) => e.regiao(aba, ref));
      if (erro) errosEncontrados.set(erro[0], (errosEncontrados.get(erro[0]) ?? 0) + 1);
      else inexplicadas.push(`${chave}: motor=${v} planilha=${g}`);
    }
    expect(inexplicadas.slice(0, 40), `${inexplicadas.length} diferenças sem explicação em ${comparadas} células`).toEqual([]);
    expect(comparadas).toBeGreaterThan(40000);
  });

  it("cobre todas as células numéricas de cálculo da planilha", () => {
    const faltando: string[] = [];
    for (const [aba, cels] of Object.entries(golden)) {
      if (aba === "Informações" || aba === "Lista_Suspensa") continue;
      for (const [ref, g] of Object.entries(cels)) {
        if (typeof g !== "number" || esperado.has(`${aba}!${ref}`) || ehExibicao(aba, ref, g)) continue;
        if (ERROS_DA_PLANILHA.P9!.regiao(aba, ref) && resumo(ref, 2029)) continue; // coluna de um ano inexistente
        faltando.push(`${aba}!${ref} ${formulas[aba]?.[ref]?.[0]}`);
      }
    }
    expect(faltando.slice(0, 40), `${faltando.length} células sem correspondência no motor`).toEqual([]);
  });
});

describe("lista de erros da planilha", () => {
  it.each(Object.keys(ERROS_DA_PLANILHA))("%s aparece nos casos de teste", (id) => {
    expect(errosEncontrados.get(id) ?? 0, ERROS_DA_PLANILHA[id]!.descricao).toBeGreaterThan(0);
  });
});
