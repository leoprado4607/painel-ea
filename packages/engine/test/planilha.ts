/**
 * Mapa "resultado do motor → célula da planilha original", usado só nos testes.
 * Para cada aba de saída, devolve o valor que a célula deveria ter segundo o motor.
 */
import { dinheiro, type ResultadoAno, type ResultadoCalculo } from "../src";

export type Celulas = Map<string, number | string>;

const ANO0 = 2006;
export const letra = (col: number): string => {
  let s = "";
  for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const cel = (aba: string, col: number, linha: number) => `${aba}!${letra(col)}${linha}`;
const yy = (ano: number) => String(ano % 100).padStart(2, "0");

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro",
  "Outubro", "Novembro", "Dezembro"];

export const ABA = {
  calc: "Cálculo do Acumulado",
  cf: "Contracheque - F Financeira",
  lvd: "Lançar Valor Devido",
  ffc: "F Financeira-Corrigida",
  vdc: "Valor Devido - Corrigida",
  vlc: "Valor_Líquido_Corrigido",
  ca: "Códigos-Anos",
  cpex: "CPEX",
  recap: "Solicitação Recapitulação",
  resumo: "Resumo",
  info: "Informações",
  lista: "Lista_Suspensa",
} as const;

/** Linha de cabeçalho do ano em cada aba de blocos anuais. */
export const cabecalho = {
  lancamento: (ano: number) => 5 + 19 * (ano - ANO0), // Contracheque / Lançar Valor Devido
  corrigida: (ano: number) => 4 + 20 * (ano - ANO0), // F Financeira-Corrigida / Valor Devido - Corrigida
  liquido: (ano: number) => 4 + 19 * (ano - ANO0), // Valor_Líquido_Corrigido
};

export interface Layout { primeiraLinha: number; linhaImportancia: number; primeiraLinhaVerso: number }

export interface Opcoes {
  /**
   * Layout da aba "Solicitação NN" (varia por ano): linha da 1ª rubrica e linha da importância básica.
   * Padrão: rubricas a partir da linha 20 e importância na D18.
   */
  layoutSolicitacao?: (ano: number) => Layout;
}

export function celulasEsperadas(r: ResultadoCalculo, op: Opcoes = {}): Celulas {
  const c: Celulas = new Map();
  const set = (aba: string, col: number, linha: number, v: number | string) => c.set(cel(aba, col, linha), v);

  // Cálculo do Acumulado (linhas 3…999)
  r.tabela.linhas.forEach((l, i) => {
    set(ABA.calc, 3, 3 + i, l.calculo); set(ABA.calc, 4, 3 + i, l.fator);
    set(ABA.calc, 5, 3 + i, l.acumulado); set(ABA.calc, 6, 3 + i, l.numeroIndice);
  });
  for (let linha = 3 + r.tabela.linhas.length; linha <= 999; linha++) {
    set(ABA.calc, 3, linha, 1);
    if (linha <= 997) set(ABA.calc, 4, linha, 1);
    if (linha <= 998) { set(ABA.calc, 5, linha, 0); set(ABA.calc, 6, linha, 100); }
  }
  const ate = r.tabela.atualizadoAte;
  if (ate) {
    const rotulo = `${MESES[ate.mes - 1]}/${ate.ano}`;
    set(ABA.calc, 7, 1000, rotulo);
    set(ABA.info, 2, 18, rotulo);
  }

  for (const a of r.anos) {
    blocoLancamento(set, ABA.cf, a, a.totalRecebidoMes);
    blocoLancamento(set, ABA.lvd, a, a.totalDevidoMes);
    blocoCorrigida(set, ABA.ffc, a, a.recebidoCorrigido, a.recebidoCorrigidoAno, a.totalRecebidoCorrigidoMes, a.totalRecebidoCorrigidoAno);
    blocoCorrigida(set, ABA.vdc, a, a.devidoCorrigido, a.devidoCorrigidoAno, a.totalDevidoCorrigidoMes, a.totalDevidoCorrigidoAno);
    blocoLiquido(set, a);
    abasDoAno(set, a, op.layoutSolicitacao?.(a.ano) ?? { primeiraLinha: 20, linhaImportancia: 18, primeiraLinhaVerso: 15 });
  }

  // Códigos-Anos
  const secoes = [r.codigosAnos.recebidoSemCorrecao, r.codigosAnos.devidoSemCorrecao,
    r.codigosAnos.diferencaSemCorrecao, r.codigosAnos.diferencaComCorrecao];
  secoes.forEach((s, i) => {
    const base = 4 + 20 * i;
    for (const a of r.anos) {
      const col = 3 + (a.ano - ANO0);
      s.porAno[a.ano]!.forEach((v, p) => set(ABA.ca, col, base + p, v));
      set(ABA.ca, col, base + 17, s.totalPosicionalPorAno[a.ano]!);
    }
    s.totalPeriodo.forEach((v, p) => set(ABA.ca, 27, base + p, v));
    set(ABA.ca, 28, base, s.receitas);
    set(ABA.ca, 28, base + 12, s.despesas);
    set(ABA.ca, 28, base + 17, s.saldo);
  });

  // CPEX
  r.cpex.semCorrecao.forEach((v, p) => set(ABA.cpex, 6, 16 + p, v));
  r.cpex.comCorrecao.forEach((v, p) => set(ABA.cpex, 9, 16 + p, v));
  set(ABA.cpex, 6, 33, r.cpex.totalSemCorrecao);
  set(ABA.cpex, 9, 33, r.cpex.totalComCorrecao);
  set(ABA.cpex, 6, 13, r.cpex.importanciaBasicaTotalCorrigida);
  set(ABA.cpex, 3, 41, r.cpex.valorCorrigidoPensaoJudicial);

  // Solicitação Recapitulação
  for (const a of r.anos) {
    const linha = 20 + (a.ano - ANO0);
    const rc = r.recapitulacao.porAno[a.ano]!;
    set(ABA.recap, 3, linha, rc.receitas); set(ABA.recap, 5, linha, rc.despesas); set(ABA.recap, 6, linha, rc.saldo);
  }
  set(ABA.recap, 3, 43, r.recapitulacao.receitas);
  set(ABA.recap, 5, 43, r.recapitulacao.despesas);
  set(ABA.recap, 6, 43, r.recapitulacao.saldo);
  set(ABA.recap, 22, 43, r.recapitulacao.saldo); // V43: cópia solta de F43

  // Resumo: blocos de 20 linhas com dois anos lado a lado (2006…2029).
  for (let k = 0; k < 12; k++) {
    const cab = 8 + 20 * k;
    for (const lado of [0, 1]) {
      const anoColuna = ANO0 + 2 * k + lado;
      const col = lado === 0 ? 3 : 8;
      for (let p = 0; p <= 17; p++) {
        const total = p === 17;
        const a = r.porAno[anoColuna];
        if (!a) continue;
        const aReceber = total ? a.verso.total.devido : a.verso.devido[p]!;
        const recebido = total ? a.verso.total.recebido : a.verso.recebido[p]!;
        set(ABA.resumo, col, cab + 1 + p, aReceber);
        set(ABA.resumo, col + 1, cab + 1 + p, recebido);
        set(ABA.resumo, col + 2, cab + 1 + p, dinheiro(aReceber - recebido));
      }
    }
  }

  set(ABA.lista, 3, 15, r.despesasCompactadas);
  return c;
}

type Set = (aba: string, col: number, linha: number, v: number | string) => void;

function blocoLancamento(set: Set, aba: string, a: ResultadoAno, totalMes: number[]) {
  const linhaTotal = cabecalho.lancamento(a.ano) + 18;
  totalMes.forEach((v, m) => set(aba, 4 + m, linhaTotal, v));
}

function blocoCorrigida(set: Set, aba: string, a: ResultadoAno, m: number[][], totalLinha: number[], totalMes: number[], totalAno: number) {
  const cab = cabecalho.corrigida(a.ano);
  a.acumuladoMes.forEach((v, i) => set(aba, 3 + i, cab + 1, v));
  m.forEach((linha, p) => {
    linha.forEach((v, i) => set(aba, 3 + i, cab + 2 + p, v));
    set(aba, 15, cab + 2 + p, totalLinha[p]!);
  });
  totalMes.forEach((v, i) => set(aba, 3 + i, cab + 19, v));
  set(aba, 15, cab + 19, totalAno);
}

function blocoLiquido(set: Set, a: ResultadoAno) {
  const cab = cabecalho.liquido(a.ano);
  a.liquidoCorrigido.forEach((linha, p) => {
    linha.forEach((v, i) => set(ABA.vlc, 3 + i, cab + 1 + p, v));
    set(ABA.vlc, 15, cab + 1 + p, a.liquidoCorrigidoAno[p]!);
  });
  a.totalLiquidoMes.forEach((v, i) => set(ABA.vlc, 3 + i, cab + 18, v));
  set(ABA.vlc, 15, cab + 18, a.totalLiquidoAno);
  set(ABA.vlc, 16, cab + 3, a.liquidoReceitas);
  set(ABA.vlc, 16, cab + 12, a.liquidoDespesas);
  set(ABA.vlc, 16, cab + 18, a.liquidoSaldo);
}

function abasDoAno(set: Set, a: ResultadoAno, lay: Layout) {
  const solic = `Solicitação ${yy(a.ano)}`;
  const verso = `${solic} Verso`;
  const v = a.verso;
  for (let p = 0; p < 17; p++) {
    const lv = lay.primeiraLinhaVerso + p;
    set(verso, 4, lv, v.devido[p]!); set(verso, 5, lv, v.recebido[p]!);
    set(verso, 6, lv, v.diferenca[p]!); set(verso, 7, lv, v.corrigido[p]!);
    set(solic, 4, lay.primeiraLinha + p, v.diferenca[p]!); set(solic, 5, lay.primeiraLinha + p, v.corrigido[p]!);
  }
  const lt = lay.primeiraLinhaVerso + 17;
  set(verso, 4, lt, v.total.devido); set(verso, 5, lt, v.total.recebido);
  set(verso, 6, lt, v.total.diferenca); set(verso, 7, lt, v.total.corrigido);
  set(solic, 4, lay.primeiraLinha + 17, v.total.diferenca); set(solic, 5, lay.primeiraLinha + 17, v.total.corrigido);
  set(solic, 4, lay.linhaImportancia, a.importanciaBasica);

  // NN-Recebido / NN-Devido: 4 grupos de 3 meses (valor e corrigido).
  for (const [aba, bruto, corrigido] of [
    [`${yy(a.ano)}-Recebido`, a.recebido, a.recebidoCorrigido],
    [`${yy(a.ano)}-Devido`, a.devido, a.devidoCorrigido],
  ] as const) {
    for (let g = 0; g < 4; g++) {
      const cab = 7 + 19 * g;
      for (let k = 0; k < 3; k++) {
        const mes = 3 * g + k;
        const colValor = 3 + 3 * k;
        set(aba, colValor + 2, cab, a.acumuladoMes[mes]!);
        for (let p = 0; p < 17; p++) {
          set(aba, colValor, cab + 1 + p, bruto[p]![mes]!);
          set(aba, colValor + 2, cab + 1 + p, corrigido[p]![mes]!);
        }
      }
    }
  }
}
