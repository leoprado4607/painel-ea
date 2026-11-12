-- Rascunho compartilhado (11/11/2026).
--
-- Processo em RASCUNHO pode ser alterado e emitido por qualquer usuário ativo: um operador começa o cálculo e outro
-- termina e emite. Depois de emitido, continua como antes: só quem criou (ou o Admin) reabre; excluir, só quem criou
-- (ou o Admin). O criador (criado_por) não muda. Quem assina os documentos é quem emite, e o Admin (Ordenador de
-- Despesas) não emite.

create or replace function pode_alterar_processo(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eh_admin() or (eh_usuario_ativo() and exists (
    select 1 from processo p where p.id = pid and (p.criado_por = auth.uid() or p.situacao = 'rascunho')))
$$;

-- ---------------------------------------------------------------- processo
-- USING: o criador altera sempre (reabrir); os demais, só em rascunho (inclui emitir: rascunho → emitido).
drop policy if exists processo_alterar on processo;
create policy processo_alterar on processo for update to authenticated
  using (eh_admin() or (eh_usuario_ativo() and (criado_por = auth.uid() or situacao = 'rascunho')))
  with check (eh_admin() or eh_usuario_ativo());

-- o criador não muda (antes a política garantia isso exigindo criado_por = auth.uid()); só o Admin pode trocar.
-- O Admin é o Ordenador de Despesas: não emite (rascunho → emitido); só operadores emitem. Reabrir ele pode.
create or replace function manter_criador_processo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.criado_por is distinct from old.criado_por and not eh_admin() then
    raise exception 'o criador do processo não pode ser alterado' using errcode = '42501';
  end if;
  if old.situacao = 'rascunho' and new.situacao = 'emitido' and eh_admin() then
    raise exception 'o Admin (Ordenador de Despesas) não emite cálculos: só operadores' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists processo_manter_criador on processo;
create trigger processo_manter_criador before update on processo
  for each row execute function manter_criador_processo();

-- ---------------------------------------------------------------- militar (aba Informações)
drop policy if exists militar_alterar on militar;
create policy militar_alterar on militar for update to authenticated
  using (eh_admin() or (eh_usuario_ativo() and (
    exists (select 1 from processo p where p.militar_id = militar.id and (p.criado_por = auth.uid() or p.situacao = 'rascunho'))
    or not exists (select 1 from processo p where p.militar_id = militar.id))))
  with check (eh_usuario_ativo());

-- ---------------------------------------------------------------- quem iniciou cada processo
-- O operador não lê o perfil dos outros (RLS); para o card de "Meus cálculos", só nome e posto de quem criou.
create or replace function operadores_dos_processos(pids uuid[]) returns table (processo_id uuid, nome text, posto text)
language sql stable security definer set search_path = public as $$
  select p.id, pf.nome, pf.posto from processo p join perfil pf on pf.usuario_id = p.criado_por
  where p.id = any (pids) and eh_usuario_ativo()
$$;

revoke all on function operadores_dos_processos(uuid[]) from public;
grant execute on function operadores_dos_processos(uuid[]) to authenticated;
