-- Exclusão de processos pelo Admin (19/10/2026).
--
-- 1) A trava "processo emitido não muda" rodava também na exclusão em cascata dos lançamentos e rubricas:
--    nesse momento o processo já foi apagado, a situação vinha vazia e a trava barrava tudo. Se o processo
--    não existe mais, é a própria exclusão dele: deixa passar.
-- 2) Só o Admin exclui processos e militares. Operadores continuam lendo, criando e alterando todos os processos.

create or replace function bloquear_processo_emitido() returns trigger language plpgsql as $$
declare s situacao_processo;
begin
  select situacao into s from processo where id = coalesce(new.processo_id, old.processo_id);
  if not found then
    return coalesce(new, old); -- processo sendo excluído (cascata)
  end if;
  if s is distinct from 'rascunho' then
    raise exception 'processo % não está em rascunho (situação: %)', coalesce(new.processo_id, old.processo_id), s;
  end if;
  return coalesce(new, old);
end $$;

drop policy if exists processo_todos on processo;
create policy processo_ler on processo for select to authenticated using (eh_usuario_ativo());
create policy processo_criar on processo for insert to authenticated with check (eh_usuario_ativo());
create policy processo_alterar on processo for update to authenticated using (eh_usuario_ativo()) with check (eh_usuario_ativo());
create policy processo_excluir on processo for delete to authenticated using (eh_admin());

drop policy if exists militar_todos on militar;
create policy militar_ler on militar for select to authenticated using (eh_usuario_ativo());
create policy militar_criar on militar for insert to authenticated with check (eh_usuario_ativo());
create policy militar_alterar on militar for update to authenticated using (eh_usuario_ativo()) with check (eh_usuario_ativo());
create policy militar_excluir on militar for delete to authenticated using (eh_admin());
