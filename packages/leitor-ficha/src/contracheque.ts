/**
 * Leitura do Comprovante Mensal de Rendimentos (contracheque) do CPEx a partir das palavras do PDF.
 * Usa os mesmos códigos do SIPPES da Ficha Financeira (NR/ND/AR/AD), então a correspondência com as rubricas
 * do processo é a mesma: ver contrachequeComoFicha.
 */
import { agruparLinhas, lerValor, type FichaFinanceira, type LinhaFicha, type Palavra } from "./leitor";

export interface LinhaContracheque {
  /** Ex.: NR0001 */
  codigo: string;
  natureza: "receita" | "desconto";
  acerto: boolean;
  descricao: string;
  /** "Info Complementar" (ex.: "3%", "10 / 96"), ou "" */
  info: string;
  valor: number;
}

export interface Contracheque {
  ano: number | null;
  mes: number | null;
  cabecalho: {
    nome: string | null; precCp: string | null; omVinculacao: string | null; codom: string | null;
    pgReal: string | null; pgPagamento: string | null;
    cpf: string | null; banco: string | null; agencia: string | null; conta: string | null;
  };
  linhas: LinhaContracheque[];
  totais: { receitas: number; despesas: number; liquido: number } | null;
  conferencias: { receitasOk: boolean; despesasOk: boolean; liquidoOk: boolean; ok: boolean };
  avisos: string[];
}

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
const CODIGO = /^(NR|ND|AR|AD)\d{4}$/;
const VALOR = /^-?\d{1,3}(\.\d{3})*,\d{2}$/;
const centavos = (v: number) => Math.round(v * 100);
/** Marca d'água ("Acessado por … Em: …"): fonte grande e inclinada, sobreposta às linhas. */
const ehMarcaDagua = (p: Palavra) => p.inclinada || (p.tamanho ?? 0) > 12;
const limpar = (s: string) => s.replace(/\s+/g, " ").trim() || null;

type Linha = ReturnType<typeof agruparLinhas>[number];

/** Distribui as palavras da linha de valores nas colunas definidas pela posição dos rótulos da linha de cima. */
function colunas(valores: Linha | undefined, rotulos: { chave: string; x: number }[]): Record<string, string | null> {
  const r: Record<string, string[]> = Object.fromEntries(rotulos.map((c) => [c.chave, []]));
  const ordem = [...rotulos].sort((a, b) => a.x - b.x);
  for (const p of valores?.palavras ?? []) {
    const col = [...ordem].reverse().find((c) => p.x >= c.x - 6) ?? ordem[0]!;
    r[col.chave]!.push(p.texto);
  }
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, limpar(v.join(" "))]));
}

/** Posição x da primeira palavra do rótulo (ex.: "P/G" seguido de "DE PAGAMENTO"). */
function xDoRotulo(l: Linha, ...textos: string[]): number | null {
  for (let i = 0; i < l.palavras.length; i++) {
    if (textos.every((t, k) => l.palavras[i + k]?.texto.toUpperCase().startsWith(t))) return l.palavras[i]!.x;
  }
  return null;
}

export function lerContracheque(todas: Palavra[]): Contracheque {
  const avisos: string[] = [];
  const linhas = agruparLinhas(todas.filter((p) => !ehMarcaDagua(p)));
  const proxima = (l: Linha) => linhas[linhas.indexOf(l) + 1];

  // Mês de referência: "AGOSTO / 2026"
  let ano: number | null = null, mes: number | null = null;
  for (const l of linhas) {
    const m = l.texto.toUpperCase().match(/\b(JANEIRO|FEVEREIRO|MAR[ÇC]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s*\/\s*(\d{4})\b/);
    if (m) { mes = MESES.indexOf(m[1]!.replace("MARCO", "MARÇO")) + 1; ano = Number(m[2]); break; }
  }
  if (!ano) avisos.push("Mês de referência não encontrado.");

  // Cabeçalho: três linhas de rótulos, cada uma seguida da linha de valores
  const cab: Contracheque["cabecalho"] = {
    nome: null, precCp: null, omVinculacao: null, codom: null, pgReal: null, pgPagamento: null, cpf: null, banco: null, agencia: null, conta: null,
  };
  const r1 = linhas.find((l) => xDoRotulo(l, "PREC-CP") !== null && xDoRotulo(l, "NOME") !== null);
  if (r1) {
    const v = colunas(proxima(r1), [
      { chave: "prec", x: xDoRotulo(r1, "PREC-CP")! }, { chave: "nome", x: xDoRotulo(r1, "NOME")! },
      { chave: "om", x: xDoRotulo(r1, "OM", "DE", "VINCULA") ?? Infinity },
    ]);
    cab.precCp = v.prec ? v.prec.replace(/\D/g, "") : null;
    cab.nome = v.nome;
    const om = v.om?.match(/^(.*?)\s*-\s*Cod:\s*(\d+)/i);
    cab.omVinculacao = om ? om[1]!.trim() : v.om;
    cab.codom = om ? om[2]! : null;
  }
  const r2 = linhas.find((l) => xDoRotulo(l, "P/G", "REAL") !== null);
  if (r2) {
    const v = colunas(proxima(r2), [
      { chave: "real", x: xDoRotulo(r2, "P/G", "REAL")! }, { chave: "pag", x: xDoRotulo(r2, "P/G", "DE", "PAGAMENTO") ?? Infinity },
      { chave: "dep", x: xDoRotulo(r2, "NR", "DEP") ?? Infinity }, { chave: "cat", x: xDoRotulo(r2, "CAT") ?? Infinity },
      { chave: "ind", x: xDoRotulo(r2, "IND") ?? Infinity },
    ]);
    // "7 - MAJOR" → "MAJOR" (o número é o código do posto no SIPPES)
    const pg = (s: string | null) => (s ? s.replace(/^\d+\s*-\s*/, "").trim() || null : null);
    cab.pgReal = pg(v.real);
    cab.pgPagamento = pg(v.pag);
  }
  const r3 = linhas.find((l) => xDoRotulo(l, "CPF") !== null && xDoRotulo(l, "BANCO") !== null);
  if (r3) {
    const v = colunas(proxima(r3), [
      { chave: "cpf", x: xDoRotulo(r3, "CPF")! }, { chave: "banco", x: xDoRotulo(r3, "BANCO")! },
      { chave: "ag", x: xDoRotulo(r3, "AG") ?? Infinity }, { chave: "conta", x: xDoRotulo(r3, "CONTA") ?? Infinity },
    ]);
    Object.assign(cab, { cpf: v.cpf, banco: v.banco, agencia: v.ag, conta: v.conta });
  }
  if (!cab.nome) avisos.push("Nome não encontrado no cabeçalho.");

  // Colunas da tabela: "Info Complementar" começa um pouco antes da palavra "Info"; valores ficam depois dela
  const cabTabela = linhas.find((l) => xDoRotulo(l, "CÓDIGO") !== null && xDoRotulo(l, "RECEITAS") !== null);
  const xInfo = (linhas.find((l) => xDoRotulo(l, "INFO") !== null && l.palavras.length <= 2)?.palavras[0]?.x ?? 319) - 25;
  const xReceitas = cabTabela ? xDoRotulo(cabTabela, "RECEITAS")! : 379;
  const xDespesas = cabTabela ? xDoRotulo(cabTabela, "DESPESAS") ?? 438 : 438;

  const itens: LinhaContracheque[] = [];
  let totais: Contracheque["totais"] = null;
  for (const l of linhas) {
    const [primeira, ...resto] = l.palavras;
    if (primeira && CODIGO.test(primeira.texto)) {
      const valorP = [...resto].reverse().find((p) => VALOR.test(p.texto) && p.x >= xReceitas - 30);
      if (!valorP) { avisos.push(`${primeira.texto}: valor não encontrado.`); continue; }
      const codigo = primeira.texto;
      const natureza = codigo[1] === "R" ? "receita" : "desconto";
      // confere com a coluna: receita termina antes de "Despesas"
      const naColunaDeReceita = valorP.x + valorP.largura < xDespesas;
      if ((natureza === "receita") !== naColunaDeReceita) avisos.push(`${codigo}: valor em coluna diferente do esperado para ${natureza}.`);
      const meio = resto.filter((p) => p !== valorP);
      itens.push({
        codigo, natureza, acerto: codigo[0] === "A",
        descricao: meio.filter((p) => p.x < xInfo).map((p) => p.texto).join(" "),
        info: meio.filter((p) => p.x >= xInfo).map((p) => p.texto).join(" "),
        valor: lerValor(valorP.texto),
      });
    } else if (primeira?.texto === "R$") {
      const v = l.palavras.filter((p) => VALOR.test(p.texto)).map((p) => lerValor(p.texto));
      if (v.length === 3) totais = { receitas: v[0]!, despesas: v[1]!, liquido: v[2]! };
    }
  }
  if (!itens.length) avisos.push("Nenhuma linha de pagamento encontrada.");

  const soma = (n: LinhaContracheque["natureza"]) => itens.filter((i) => i.natureza === n).reduce((s, i) => s + centavos(i.valor), 0);
  const receitasOk = !!totais && soma("receita") === centavos(totais.receitas);
  const despesasOk = !!totais && soma("desconto") === centavos(totais.despesas);
  const liquidoOk = !!totais && centavos(totais.receitas) - centavos(totais.despesas) === centavos(totais.liquido);
  if (!totais) avisos.push("Linha de totais (R$) não encontrada.");
  else if (!receitasOk || !despesasOk || !liquidoOk) avisos.push("A soma das linhas não confere com os totais do contracheque.");

  return { ano, mes, cabecalho: cab, linhas: itens, totais, conferencias: { receitasOk, despesasOk, liquidoOk, ok: receitasOk && despesasOk && liquidoOk }, avisos };
}

/**
 * O contracheque como uma Ficha Financeira de um mês só, para usar a mesma correspondência de rubricas
 * (aplicarCorrespondencia) e a mesma gravação dos valores recebidos.
 */
export function contrachequeComoFicha(c: Contracheque): FichaFinanceira {
  const linhas: LinhaFicha[] = c.linhas.map((l) => {
    const meses = Array<number>(12).fill(0);
    if (c.mes) meses[c.mes - 1] = l.valor;
    return { codigo: l.codigo, natureza: l.natureza, acerto: l.acerto, descricao: l.info ? `${l.descricao} (${l.info})` : l.descricao, meses, total: l.valor };
  });
  return {
    ano: c.ano,
    cabecalho: {
      posto: c.cabecalho.pgPagamento ?? c.cabecalho.pgReal, nome: c.cabecalho.nome, precCp: c.cabecalho.precCp, identidade: null,
      cpf: c.cabecalho.cpf, codom: c.cabecalho.codom, rm: null, siglaUa: c.cabecalho.omVinculacao,
    },
    linhas,
    totaisLiquidos: null,
    conferencias: { linhasDivergentes: [], mesesDivergentes: c.conferencias.ok || !c.mes ? [] : [c.mes], ok: c.conferencias.ok },
    avisos: c.avisos,
  };
}
