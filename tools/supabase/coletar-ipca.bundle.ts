// Versão em arquivo único de coletar-ipca (para colar no editor do painel do Supabase).
// Gerado por tools/supabase/empacotar-funcao.sh a partir de _shared/ipca.ts e coletar-ipca/index.ts.

// Edge Function: coleta IPCA e IPCA-E nas fontes oficiais e grava em indice_mensal.
// Chamada todo dia pelo pg_cron (migração 20261017000400_agendamento.sql); pode ser chamada à mão (POST).
// Não exige chave: só busca dados públicos e grava índices. Para evitar abuso, roda no máximo 1 vez a cada 10 min.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SERIES: Serie[] = ["IPCA", "IPCA-E"];
const MESES_REVISAR = 12; // rebusca os últimos 12 meses para detectar revisões
const INTERVALO_MINIMO_MS = 10 * 60_000;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ erro: "use POST" }), { status: 405 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: ultima } = await db.from("coleta_indice").select("executada_em")
    .order("executada_em", { ascending: false }).limit(1).maybeSingle();
  if (ultima && Date.now() - new Date(ultima.executada_em).getTime() < INTERVALO_MINIMO_MS) {
    return new Response(JSON.stringify({ situacao: "aguarde", mensagem: "coleta executada há menos de 10 minutos" }), { status: 429 });
  }
  const buscar = async (url: string) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  };

  const resultado: Record<string, unknown> = {};
  for (const serie of SERIES) {
    try {
      const { data: ultimo, error: e1 } = await db.from("indice_mensal").select("ano, mes")
        .eq("serie", serie).order("ano", { ascending: false }).order("mes", { ascending: false }).limit(1).maybeSingle();
      if (e1) throw e1;
      const base = ultimo ? new Date(Date.UTC(ultimo.ano, ultimo.mes - 1 - MESES_REVISAR, 1)) : new Date(Date.UTC(2000, 9, 1));
      const inicio = { ano: base.getUTCFullYear(), mes: base.getUTCMonth() + 1 };

      const { indices, fonte, erros } = await buscarSerie(serie, inicio, buscar);
      const { data: gravados, error: e2 } = await db.from("indice_mensal").select("ano, mes, percentual")
        .eq("serie", serie).gte("ano", inicio.ano);
      if (e2) throw e2;
      const plano = planejar(indices, gravados ?? []);
      const gravar = [...plano.novos, ...plano.revisados].map(({ serie, ano, mes, percentual, fonte }) =>
        ({ serie, ano, mes, percentual, fonte, coletado_em: new Date().toISOString() }));
      if (gravar.length) {
        const { error: e3 } = await db.from("indice_mensal").upsert(gravar);
        if (e3) throw e3;
      }
      const situacao = gravar.length ? "ok" : "sem_novidade";
      await db.from("coleta_indice").insert({
        serie, fonte, situacao, meses_novos: plano.novos.length,
        revisoes: plano.revisados.map((r) => ({ ano: r.ano, mes: r.mes, anterior: r.anterior, novo: r.percentual })),
        mensagem: erros.length ? `fonte principal falhou: ${erros.join(" | ")}` : null,
      });
      resultado[serie] = { situacao, fonte, novos: plano.novos.map((n) => `${n.ano}-${n.mes}`), revisoes: plano.revisados.length };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : JSON.stringify(e);
      await db.from("coleta_indice").insert({ serie, situacao: "erro", mensagem });
      resultado[serie] = { situacao: "erro", mensagem };
    }
  }
  return new Response(JSON.stringify(resultado), { headers: { "Content-Type": "application/json" } });
});

// ---------------------------------------------------------------- _shared/ipca.ts
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
