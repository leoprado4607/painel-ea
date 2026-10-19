// Edge Function: coleta IPCA e IPCA-E nas fontes oficiais e grava em indice_mensal.
// Chamada todo dia pelo pg_cron (migração 20261017000400_agendamento.sql); pode ser chamada à mão (POST).
// Não exige chave: só busca dados públicos e grava índices. Para evitar abuso, roda no máximo 1 vez a cada 10 min.
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { buscarSerie, planejar, type Serie } from "../_shared/ipca.ts";

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
