-- Coleta diária do IPCA/IPCA-E: o pg_cron chama a Edge Function coletar-ipca às 09:00 (Brasília).
-- A função só lê dados públicos (IBGE/Banco Central) e não exige chave: não há segredo a guardar.
-- Pré-requisito (uma vez, no SQL Editor): informar a URL do projeto, que não é segredo:
--   insert into configuracao (chave, valor) values ('url_projeto', 'https://<ref-do-projeto>.supabase.co');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Parâmetros do sistema lidos pelo banco (sem políticas: só o próprio banco e a service role acessam).
create table if not exists configuracao (chave text primary key, valor text not null);
alter table configuracao enable row level security;

select cron.schedule(
  'coletar-ipca-diario',
  '0 12 * * *',  -- 12:00 UTC = 09:00 em Brasília
  $$
  select net.http_post(
    url := (select valor from configuracao where chave = 'url_projeto') || '/functions/v1/coletar-ipca',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Alerta: o IPCA de um mês sai por volta do dia 10 do mês seguinte; mais de 75 dias sem mês novo indica coleta parada.
create view situacao_indices with (security_invoker = true) as
select serie,
       max(make_date(ano, mes, 1)) as ultimo_mes,
       (date_trunc('month', now())::date - max(make_date(ano, mes, 1))) > 75 as atrasado,
       (select max(executada_em) from coleta_indice c where c.serie = i.serie) as ultima_coleta,
       (select situacao from coleta_indice c where c.serie = i.serie order by executada_em desc limit 1) as situacao_ultima_coleta
from indice_mensal i
group by serie;
