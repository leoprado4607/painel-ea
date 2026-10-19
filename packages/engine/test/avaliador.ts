/**
 * Avaliador mínimo das fórmulas da planilha original (só os formatos que ela usa), para os testes.
 * Reproduz a "Precisão conforme exibido": cada célula é arredondada às casas do seu formato.
 * Células de texto (rótulos, tipos Receita/Despesa) vêm do valor gravado pelo Excel.
 */
import { arredondar } from "../src";

export type Valor = number | string | null;
export type Formulas = Record<string, Record<string, [string | number, number | null]>>;
export type Golden = Record<string, Record<string, Valor>>;

const NOMES: Record<string, string> = {
  Calculo_do_Acumulado: "'Cálculo do Acumulado'!A3:G1000",
};

const colNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const colLetra = (n: number): string => (n > 26 ? colLetra(Math.floor((n - 1) / 26)) : "") + String.fromCharCode(65 + ((n - 1) % 26));

interface Ref { aba: string; c1: number; l1: number; c2: number; l2: number }
type No =
  | { t: "num"; v: number } | { t: "str"; v: string } | { t: "ref"; r: Ref }
  | { t: "bin"; op: string; a: No; b: No } | { t: "neg"; a: No } | { t: "fn"; nome: string; args: No[] };

export class Planilha {
  private cache = new Map<string, Valor>();
  private tabelasProcv = new Map<string, Map<string, number>>();
  constructor(
    private formulas: Formulas,
    private golden: Golden,
    /** Valores digitados (entradas do caso), por "aba!A1". */
    private entradas: Map<string, number>,
    /** Códigos das 17 posições (para os nomes Código1…Código17). */
    private codigos: string[],
  ) {}

  valor(aba: string, ref: string): Valor {
    const k = `${aba}!${ref}`;
    if (this.cache.has(k)) return this.cache.get(k)!;
    let v: Valor;
    const ent = this.entradas.get(k);
    const def = this.formulas[aba]?.[ref];
    const g = this.golden[aba]?.[ref];
    if (ent !== undefined) v = ent;
    else if (typeof g === "string") v = g; // texto: usa o que o Excel gravou
    else if (def === undefined) v = null; // célula vazia
    else if (typeof def[0] === "number") v = def[0];
    else if (!def[0].startsWith("=")) v = def[0]; // texto fixo (ex.: rótulos de mês do Cálculo do Acumulado)
    else {
      const r = this.avaliar(parse(def[0].slice(1), aba), aba) ?? 0; // =A1 com A1 vazio dá 0
      v = typeof r === "number" && def[1] !== null ? arredondar(r, def[1]) : r;
    }
    this.cache.set(k, v);
    return v;
  }

  private celulas(r: Ref): Valor[] {
    const out: Valor[] = [];
    for (let l = r.l1; l <= r.l2; l++) for (let c = r.c1; c <= r.c2; c++) out.push(this.valor(r.aba, `${colLetra(c)}${l}`));
    return out;
  }

  private num(v: Valor): number {
    if (v === null || v === "") return 0;
    if (typeof v === "number") return v;
    const n = Number(v);
    if (Number.isNaN(n)) throw new Error(`#VALUE!: "${v}"`);
    return n;
  }

  private avaliar(n: No, aba: string): Valor {
    switch (n.t) {
      case "num": case "str": return n.v;
      case "ref": {
        if (n.r.c1 !== n.r.c2 || n.r.l1 !== n.r.l2) throw new Error("intervalo fora de função");
        return this.valor(n.r.aba, `${colLetra(n.r.c1)}${n.r.l1}`);
      }
      case "neg": return -this.num(this.avaliar(n.a, aba));
      case "bin": {
        const a = this.avaliar(n.a, aba), b = this.avaliar(n.b, aba);
        if (n.op === "&") return `${a ?? ""}${b ?? ""}`;
        if (n.op === "=") return String(a ?? "").toUpperCase() === String(b ?? "").toUpperCase() ? 1 : 0;
        const x = this.num(a), y = this.num(b);
        return n.op === "+" ? x + y : n.op === "-" ? x - y : n.op === "*" ? x * y : x / y;
      }
      case "fn": return this.funcao(n.nome, n.args, aba);
    }
  }

  private intervalo(n: No): Valor[] {
    if (n.t !== "ref") throw new Error("esperado intervalo");
    return this.celulas(n.r);
  }

  private funcao(nome: string, args: No[], aba: string): Valor {
    const somaNum = (vs: Valor[]) => vs.reduce<number>((s, v) => (typeof v === "number" ? s + v : s), 0);
    switch (nome) {
      case "SUM":
        return args.reduce<number>((s, a) => s + (a.t === "ref" ? somaNum(this.intervalo(a)) : this.num(this.avaliar(a, aba))), 0);
      case "SUMIFS": {
        const soma = this.intervalo(args[0]!), crit = this.intervalo(args[1]!);
        const alvo = String(this.avaliar(args[2]!, aba)).toUpperCase();
        return soma.reduce<number>((s, v, i) => (String(crit[i] ?? "").toUpperCase() === alvo && typeof v === "number" ? s + v : s), 0);
      }
      case "ROUND": return arredondar(this.num(this.avaliar(args[0]!, aba)), this.num(this.avaliar(args[1]!, aba)));
      case "IF": {
        const cond = this.avaliar(args[0]!, aba);
        return this.num(cond) !== 0 ? this.avaliar(args[1]!, aba) : this.avaliar(args[2]!, aba);
      }
      case "VLOOKUP": {
        const chave = String(this.avaliar(args[0]!, aba)).toUpperCase();
        const tab = args[1]!;
        if (tab.t !== "ref") throw new Error("VLOOKUP sem intervalo");
        const col = this.num(this.avaliar(args[2]!, aba));
        const id = `${tab.r.aba}!${tab.r.c1}:${tab.r.l1}:${tab.r.l2}`;
        let indice = this.tabelasProcv.get(id);
        if (!indice) {
          indice = new Map();
          for (let l = tab.r.l2; l >= tab.r.l1; l--) // de baixo para cima: fica a 1ª ocorrência
            indice.set(String(this.valor(tab.r.aba, `${colLetra(tab.r.c1)}${l}`) ?? "").toUpperCase(), l);
          this.tabelasProcv.set(id, indice);
        }
        const l = indice.get(chave);
        if (l === undefined) throw new Error(`#N/A: ${chave}`);
        return this.valor(tab.r.aba, `${colLetra(tab.r.c1 + col - 1)}${l}`);
      }
      default: {
        const m = /^Código(\d+)$/.exec(nome);
        if (m) return this.codigos[Number(m[1]) - 1] || null;
        throw new Error(`função não suportada: ${nome}`);
      }
    }
  }
}

// ---- parser ----
function parse(src: string, abaAtual: string): No {
  let i = 0;
  const ws = () => { while (src[i] === " ") i++; };
  const peek = () => (ws(), src[i]);
  const comparacao = (): No => {
    let a = concat();
    while (peek() === "=") { i++; a = { t: "bin", op: "=", a, b: concat() }; }
    return a;
  };
  const concat = (): No => {
    let a = soma();
    while (peek() === "&") { i++; a = { t: "bin", op: "&", a, b: soma() }; }
    return a;
  };
  const soma = (): No => {
    let a = termo();
    for (let c = peek(); c === "+" || c === "-"; c = peek()) { i++; a = { t: "bin", op: c, a, b: termo() }; }
    return a;
  };
  const termo = (): No => {
    let a = fator();
    for (let c = peek(); c === "*" || c === "/"; c = peek()) { i++; a = { t: "bin", op: c, a, b: fator() }; }
    return a;
  };
  const fator = (): No => {
    const c = peek();
    if (c === "-") { i++; return { t: "neg", a: fator() }; }
    if (c === "$") return { t: "ref", r: lerRef(abaAtual) };
    if (c === "(") { i++; const e = comparacao(); ws(); i++; return e; }
    if (c === '"') { const j = src.indexOf('"', i + 1); const v = src.slice(i + 1, j); i = j + 1; return { t: "str", v }; }
    const num = /^\d+(\.\d+)?%?/.exec(src.slice(i));
    if (num) { i += num[0].length; const v = parseFloat(num[0]); return { t: "num", v: num[0].endsWith("%") ? v / 100 : v }; }
    // referência com aba entre aspas
    if (c === "'") {
      const j = src.indexOf("'!", i + 1);
      const aba = src.slice(i + 1, j); i = j + 2;
      return { t: "ref", r: lerRef(aba) };
    }
    const id = /^[A-Za-zÀ-ú_][\wÀ-ú.]*/.exec(src.slice(i))![0];
    i += id.length;
    if (src[i] === "!") { i++; return { t: "ref", r: lerRef(id) }; }
    if (src[i] === "(") {
      i++; const args: No[] = [];
      if (peek() !== ")") { args.push(comparacao()); while (peek() === ",") { i++; args.push(comparacao()); } }
      ws(); i++;
      return { t: "fn", nome: id, args };
    }
    if (NOMES[id]) return parse(NOMES[id]!, abaAtual);
    if (/^\$?[A-Z]{1,3}\$?\d+$/.test(id) || /^[A-Z]{1,3}$/.test(id)) { i -= id.length; return { t: "ref", r: lerRef(abaAtual) }; }
    return { t: "fn", nome: id, args: [] }; // nome definido (Código1…)
  };
  const lerRef = (aba: string): Ref => {
    const m = /^\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?/.exec(src.slice(i))!;
    i += m[0].length;
    const c1 = colNum(m[1]!), l1 = Number(m[2]);
    return { aba, c1, l1, c2: m[3] ? colNum(m[3]) : c1, l2: m[4] ? Number(m[4]) : l1 };
  };
  const e = comparacao();
  return e;
}
