-- 11/11/2026
-- 1) Quem emitiu cada versão: o operador que clicou em "Imprimir compilado" ou "Download arquivos" (pode não ser quem
--    criou o processo). documento.criado_por já guarda o usuário; o nome ("Cb Fulano de Tal") fica gravado na emissão,
--    porque o operador não lê o perfil dos outros (RLS) e o nome mostrado não deve mudar se o perfil mudar depois.
alter table documento add column if not exists emitido_por_nome text;

-- versões emitidas antes: nome atual de quem gerou
update documento d set emitido_por_nome = trim(concat_ws(' ', pf.posto, pf.nome))
from perfil pf where pf.usuario_id = d.criado_por and d.emitido_por_nome is null;

-- 2) Repositório de explicações do não pagamento à época, por espécie da dívida: P/G e nome do militar, operador
--    (quem emitiu a última versão; em rascunho, quem criou), período e o texto. Para qualquer usuário ativo.
create or replace function repositorio_explicacoes(p_especie text)
returns table (
  processo_id uuid, militar_posto text, militar_nome text, operador text, emitido boolean,
  periodo_inicio date, periodo_fim date, explicacao text
)
language sql stable security definer set search_path = public as $$
  select p.id, m.posto_graduacao, m.nome,
    coalesce(ult.emitido_por_nome, nullif(trim(concat_ws(' ', pf.posto, pf.nome)), '')),
    ult.emitido_por_nome is not null,
    p.periodo_inicio, p.periodo_fim, p.complementos->>'explicacao'
  from processo p
  join militar m on m.id = p.militar_id
  left join perfil pf on pf.usuario_id = p.criado_por
  left join lateral (
    select d.emitido_por_nome from documento d
    where d.processo_id = p.id and d.tipo = 'pacote_completo' and p.situacao <> 'rascunho'
    order by d.versao desc limit 1
  ) ult on true
  where eh_usuario_ativo() and p.especie_divida = p_especie
    and coalesce(trim(p.complementos->>'explicacao'), '') <> ''
  order by p.atualizado_em desc
$$;

revoke all on function repositorio_explicacoes(text) from public;
grant execute on function repositorio_explicacoes(text) to authenticated;
