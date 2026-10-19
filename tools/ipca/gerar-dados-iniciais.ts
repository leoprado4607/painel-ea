/**
 * Busca IPCA e IPCA-E desde out/2000 nas fontes oficiais, confere as duas fontes de cada série
 * entre si e contra a planilha original, e gera a migração com os dados iniciais.
 *
 * Uso (Node 22+): node tools/ipca/gerar-dados-iniciais.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { FONTES, validar, type IndiceColetado, type Serie } from "../../supabase/functions/_shared/ipca.ts";

const INICIO = { ano: 2000, mes: 10 };
const RAIZ = new URL("../../", import.meta.url);
const buscar = async (url: string) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
  return r.json();
};
const chave = (i: { ano: number; mes: number }) => `${i.ano}-${String(i.mes).padStart(2, "0")}`;

const series: Record<Serie, IndiceColetado[]> = { IPCA: [], "IPCA-E": [] };
for (const serie of ["IPCA", "IPCA-E"] as Serie[]) {
  const [principal, reserva] = FONTES[serie];
  const a = validar(principal!.ler(await buscar(principal!.url(INICIO)), serie));
  const b = validar(reserva!.ler(await buscar(reserva!.url(INICIO)), serie));
  const mb = new Map(b.map((x) => [chave(x), x.percentual]));
  const difs = a.filter((x) => mb.has(chave(x)) && mb.get(chave(x)) !== x.percentual);
  console.log(`${serie}: ${principal!.nome} ${a.length} meses, ${reserva!.nome} ${b.length} meses, diferenças: ${difs.length}`);
  if (difs.length) throw new Error(`fontes divergem em ${serie}: ${difs.map(chave).join(", ")}`);
  series[serie] = a.filter((x) => x.ano * 100 + x.mes >= INICIO.ano * 100 + INICIO.mes);
}

// Comparação com a planilha original
const planilha = JSON.parse(readFileSync(new URL("packages/engine/test/golden/indices-planilha.json", RAIZ), "utf-8")) as
  { ano: number; mes: number; percentual: number | null }[];
for (const serie of ["IPCA", "IPCA-E"] as Serie[]) {
  const m = new Map(series[serie].map((x) => [chave(x), x.percentual]));
  const iguais = planilha.filter((p) => p.percentual !== null && m.get(chave(p)) === p.percentual);
  const dif = planilha.filter((p) => p.percentual !== null && m.has(chave(p)) && m.get(chave(p)) !== p.percentual);
  console.log(`planilha × ${serie}: ${iguais.length} iguais, ${dif.length} diferentes` +
    (dif.length && dif.length <= 15 ? ` (${dif.map((d) => chave(d)).join(", ")})` : ""));
}

// Uma lista de valores por série, mês a mês desde out/2000 (meses consecutivos, conferido abaixo).
const blocos = (["IPCA", "IPCA-E"] as Serie[]).map((s) => {
  const v = series[s];
  v.forEach((x, i) => {
    const k = INICIO.ano * 12 + INICIO.mes - 1 + i;
    if (x.ano !== Math.floor(k / 12) || x.mes !== (k % 12) + 1) throw new Error(`${s}: mês faltando antes de ${chave(x)}`);
  });
  const fontes = [...new Set(v.map((x) => x.fonte))];
  if (fontes.length !== 1) throw new Error(`${s}: mais de uma fonte`);
  const valores = v.map((x) => x.percentual.toFixed(2));
  const linhasValores = Array.from({ length: Math.ceil(valores.length / 12) }, (_, i) => valores.slice(i * 12, i * 12 + 12).join(","));
  return `insert into indice_mensal (serie, ano, mes, percentual, fonte)
select '${s}', extract(year from d)::int, extract(month from d)::int, v, '${fontes[0]}'
from unnest('{
${linhasValores.join(",\n")}
}'::numeric[]) with ordinality as t(v, i),
     lateral (select (date '${INICIO.ano}-${String(INICIO.mes).padStart(2, "0")}-01' + (i - 1) * interval '1 month')::date as d) m;`;
});
const linhas = (["IPCA", "IPCA-E"] as Serie[]).flatMap((s) => series[s]);
const sql = `-- Dados iniciais (gerado por tools/ipca/gerar-dados-iniciais.ts em ${new Date().toISOString().slice(0, 10)}).

-- Rubricas sugeridas (igual à aba "Códigos Lançamento" da planilha).
insert into rubrica_padrao (posicao, codigo, tipo) values
  (1, 'A01 - SOLDO', 'Receita'), (2, 'A03 - ADIC HAB', 'Receita'), (3, 'A14 - ADIC MIL', 'Receita'),
  (4, 'AL0 - ACDM', 'Receita'), (5, 'A85 - ADIC NATAL - 2ª P', 'Receita'), (6, 'AD2 - ADICIONAL FÉRIAS', 'Receita'),
  (7, '', 'Receita'), (8, '', 'Receita'), (9, '', 'Receita'), (10, '', 'Receita'), (11, '', 'Receita'), (12, '', 'Receita'),
  (13, 'Z01 - FUSEX', 'Despesa'), (14, 'Z02 - P MIL 7,5/9,5/10,5%', 'Despesa'), (15, 'Z02 - P MIL 1,5%', 'Despesa'),
  (16, 'Z99 - PENS JUDICIARIA', 'Despesa'), (17, 'ZM7 - DESC DEP FUSEX', 'Despesa');

-- Regra de vigência (decisão de 17/10/2026, problema P15 do PLANO.md):
-- IPCA até set/2025 e IPCA-E a partir de out/2025, como a planilha de set/2026.
insert into regra_indice (vigencia_inicio, serie, observacao) values
  ('2000-10-01', 'IPCA', 'IPCA de out/2000 a set/2025'),
  ('2025-10-01', 'IPCA-E', 'IPCA-E a partir de out/2025 (decisão de 17/10/2026)');

-- Séries históricas desde out/2000 (fontes conferidas entre si), 12 meses por linha a partir de out/2000.
${blocos.join("\n\n")}
`;
const destino = new URL("supabase/migrations/20261017000300_dados_iniciais.sql", RAIZ);
writeFileSync(destino, sql);
console.log(`gravado: ${destino.pathname} (${linhas.length} índices)`);
