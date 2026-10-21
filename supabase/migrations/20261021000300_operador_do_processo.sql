-- Quem assina os documentos como operador (21/10/2026): o operador que CRIOU o processo, e não quem gera o PDF
-- (antes, se o Admin gerasse, o nome dele saía em todas as assinaturas do operador).
-- O operador só lê o próprio perfil (RLS); esta função devolve só nome e posto do criador do processo, para qualquer
-- usuário ativo que pode consultar o processo.

create or replace function operador_do_processo(pid uuid) returns table (nome text, posto text)
language sql stable security definer set search_path = public as $$
  select pf.nome, pf.posto from processo p join perfil pf on pf.usuario_id = p.criado_por
  where p.id = pid and eh_usuario_ativo()
$$;

revoke all on function operador_do_processo(uuid) from public;
grant execute on function operador_do_processo(uuid) to authenticated;
