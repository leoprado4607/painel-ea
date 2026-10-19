/**
 * Coleta dos índices mensais (IPCA e IPCA-E) nas fontes oficiais. Código puro, sem APIs do Deno,
 * para ser testado com vitest e usado pela Edge Function coletar-ipca.
 *
 * Fontes (conferidas em 17/10/2026):
 *  - IPCA:   IBGE/SIDRA tabela 1737, variável 63 (principal) | Banco Central SGS 433 (reserva)
 *  - IPCA-E: Banco Central SGS 10764 (principal) | IBGE/SIDRA tabela 3065, variável 355 — IPCA-15 mensal (reserva)
 * As duas fontes de cada índice deram valores idênticos em toda a série desde out/2000.
 */

export type Serie = "IPCA" | "IPCA-E";

export interface IndiceColetado {
  serie: Serie;
  ano: number;
  mes: number;
  percentual: number;
  fonte: string;
}

export interface Fonte {
  nome: string;
  url: (inicio: { ano: number; mes: number }) => string;
  ler: (corpo: unknown, serie: Serie) => IndiceColetado[];
}

const mm = (m: number) => String(m).padStart(2, "0");

/** Resposta do SIDRA: array cuja 1ª linha é o cabeçalho; D3C = "AAAAMM", V = valor ("..." se indisponível). */
export function lerSidra(corpo: unknown, serie: Serie, fonte: string): IndiceColetado[] {
  if (!Array.isArray(corpo) || corpo.length === 0) throw new Error("SIDRA: resposta vazia ou inválida");
  return corpo.slice(1).flatMap((l: Record<string, string>) => {
    const v = Number(l.V);
    if (!/^\d{6}$/.test(l.D3C ?? "") || l.V === undefined || !Number.isFinite(v) || /^[.\-X]+$/.test(l.V)) return [];
    return [{ serie, ano: Number(l.D3C!.slice(0, 4)), mes: Number(l.D3C!.slice(4)), percentual: v, fonte }];
  });
}

/** Resposta do SGS: [{ data: "01/MM/AAAA", valor: "0.44" }]. */
export function lerSgs(corpo: unknown, serie: Serie, fonte: string): IndiceColetado[] {
  if (!Array.isArray(corpo)) throw new Error("SGS: resposta inválida");
  return corpo.flatMap((l: { data?: string; valor?: string }) => {
    const m = /^\d{2}\/(\d{2})\/(\d{4})$/.exec(l.data ?? "");
    const v = Number(l.valor);
    if (!m || l.valor === undefined || l.valor === "" || !Number.isFinite(v)) return [];
    return [{ serie, ano: Number(m[2]), mes: Number(m[1]), percentual: v, fonte }];
  });
}

const sidra = (tabela: number, variavel: number): Fonte => ({
  nome: `IBGE/SIDRA t${tabela} v${variavel}`,
  url: (i) => `https://apisidra.ibge.gov.br/values/t/${tabela}/n1/all/v/${variavel}/p/${i.ano}${mm(i.mes)}-209912`,
  ler(corpo, serie) { return lerSidra(corpo, serie, this.nome); },
});
const sgs = (codigo: number): Fonte => ({
  nome: `BCB/SGS ${codigo}`,
  url: (i) => `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=01/${mm(i.mes)}/${i.ano}`,
  ler(corpo, serie) { return lerSgs(corpo, serie, this.nome); },
});

/** Fontes de cada série, na ordem de tentativa. */
export const FONTES: Record<Serie, Fonte[]> = {
  IPCA: [sidra(1737, 63), sgs(433)],
  "IPCA-E": [sgs(10764), sidra(3065, 355)],
};

/** Variação mensal fora desta faixa é tratada como erro de leitura (o IPCA mensal desde 2000 ficou entre −0,7% e 3,1%). */
export const FAIXA_PLAUSIVEL = { min: -5, max: 10 };

export function validar(lidos: IndiceColetado[]): IndiceColetado[] {
  for (const l of lidos) {
    if (l.mes < 1 || l.mes > 12 || l.ano < 2000 || l.ano > 2100) throw new Error(`mês inválido: ${l.ano}-${l.mes}`);
    if (l.percentual < FAIXA_PLAUSIVEL.min || l.percentual > FAIXA_PLAUSIVEL.max)
      throw new Error(`valor implausível em ${l.serie} ${l.ano}-${mm(l.mes)}: ${l.percentual}`);
    if (Math.round(l.percentual * 100) / 100 !== l.percentual) throw new Error(`mais de 2 casas em ${l.serie} ${l.ano}-${mm(l.mes)}`);
  }
  return lidos;
}

export interface Plano {
  novos: IndiceColetado[];
  revisados: (IndiceColetado & { anterior: number })[];
}

/** Compara com o que já está gravado: meses novos entram; valor diferente é revisão (registrada no log). */
export function planejar(lidos: IndiceColetado[], gravados: { ano: number; mes: number; percentual: number }[]): Plano {
  const atual = new Map(gravados.map((g) => [g.ano * 100 + g.mes, Number(g.percentual)]));
  const plano: Plano = { novos: [], revisados: [] };
  for (const l of lidos) {
    const anterior = atual.get(l.ano * 100 + l.mes);
    if (anterior === undefined) plano.novos.push(l);
    else if (anterior !== l.percentual) plano.revisados.push({ ...l, anterior });
  }
  return plano;
}

/** Busca uma série tentando as fontes em ordem; devolve os índices e a fonte usada (ou os erros de todas). */
export async function buscarSerie(
  serie: Serie,
  inicio: { ano: number; mes: number },
  buscar: (url: string) => Promise<unknown>,
): Promise<{ indices: IndiceColetado[]; fonte: string; erros: string[] }> {
  const erros: string[] = [];
  for (const f of FONTES[serie]) {
    try {
      const indices = validar(f.ler(await buscar(f.url(inicio)), serie));
      return { indices, fonte: f.nome, erros };
    } catch (e) {
      erros.push(`${f.nome}: ${(e as Error).message}`);
    }
  }
  throw new Error(`nenhuma fonte respondeu para ${serie}: ${erros.join(" | ")}`);
}
