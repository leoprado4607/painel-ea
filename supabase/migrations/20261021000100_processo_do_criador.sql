-- Processo do criador (21/10/2026).
--
-- Todos os usuários ativos continuam CONSULTANDO todos os processos. Alterar, emitir, reabrir e excluir um processo
-- (e os seus lançamentos, rubricas, militar e PDFs) só pode quem o criou (processo.criado_por) ou o Admin.
-- Antes: qualquer operador alterava qualquer processo e só o Admin excluía.

create or replace function pode_alterar_processo(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eh_admin() or (eh_usuario_ativo() and exists (select 1 from processo p where p.id = pid and p.criado_por = auth.uid()))
$$;

-- ---------------------------------------------------------------- processo
drop policy if exists processo_criar on processo;
drop policy if exists processo_alterar on processo;
drop policy if exists processo_excluir on processo;
-- processo_ler (todos os ativos) continua valendo.
create policy processo_criar on processo for insert to authenticated
  with check (eh_usuario_ativo() and (criado_por = auth.uid() or eh_admin()));
-- o criador não passa o processo para outro (criado_por continua dele)
create policy processo_alterar on processo for update to authenticated
  using (eh_admin() or (eh_usuario_ativo() and criado_por = auth.uid()))
  with check (eh_admin() or (eh_usuario_ativo() and criado_por = auth.uid()));
create policy processo_excluir on processo for delete to authenticated
  using (eh_admin() or (eh_usuario_ativo() and criado_por = auth.uid()));

-- ---------------------------------------------------------------- militar
-- O militar é gravado antes do processo (ainda sem processo) e alterado pela aba Informações do processo.
drop policy if exists militar_alterar on militar;
drop policy if exists militar_excluir on militar;
-- militar_ler e militar_criar (todos os ativos) continuam valendo.
create policy militar_alterar on militar for update to authenticated
  using (eh_admin() or (eh_usuario_ativo() and (
    exists (select 1 from processo p where p.militar_id = militar.id and p.criado_por = auth.uid())
    or not exists (select 1 from processo p where p.militar_id = militar.id))))
  with check (eh_usuario_ativo());
create policy militar_excluir on militar for delete to authenticated
  using (eh_admin() or (eh_usuario_ativo() and not exists (select 1 from processo p where p.militar_id = militar.id)));

-- ---------------------------------------------------------------- rubricas, lançamentos e documentos do processo
drop policy if exists processo_rubrica_todos on processo_rubrica;
create policy processo_rubrica_ler on processo_rubrica for select to authenticated using (eh_usuario_ativo());
create policy processo_rubrica_gravar on processo_rubrica for all to authenticated
  using (pode_alterar_processo(processo_id)) with check (pode_alterar_processo(processo_id));

drop policy if exists lancamento_todos on lancamento;
create policy lancamento_ler on lancamento for select to authenticated using (eh_usuario_ativo());
create policy lancamento_gravar on lancamento for all to authenticated
  using (pode_alterar_processo(processo_id)) with check (pode_alterar_processo(processo_id));

drop policy if exists documento_todos on documento;
create policy documento_ler on documento for select to authenticated using (eh_usuario_ativo());
create policy documento_gravar on documento for all to authenticated
  using (pode_alterar_processo(processo_id)) with check (pode_alterar_processo(processo_id));

-- ---------------------------------------------------------------- PDFs emitidos (bucket "documentos")
-- Caminho <om_id>/<processo_id>/<arquivo>: todos leem; só quem pode alterar o processo grava ou apaga.
create or replace function pode_alterar_caminho_documento(caminho text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when split_part(caminho, '/', 2) ~ '^[0-9a-fA-F-]{36}$'
    then pode_alterar_processo(split_part(caminho, '/', 2)::uuid) else eh_admin() end
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'drop policy if exists documentos_todos on storage.objects';
    execute $p$
      create policy documentos_ler on storage.objects for select to authenticated
        using (bucket_id = 'documentos' and eh_usuario_ativo())
    $p$;
    execute $p$
      create policy documentos_gravar on storage.objects for insert to authenticated
        with check (bucket_id = 'documentos' and pode_alterar_caminho_documento(name))
    $p$;
    execute $p$
      create policy documentos_alterar on storage.objects for update to authenticated
        using (bucket_id = 'documentos' and pode_alterar_caminho_documento(name))
        with check (bucket_id = 'documentos' and pode_alterar_caminho_documento(name))
    $p$;
    execute $p$
      create policy documentos_apagar on storage.objects for delete to authenticated
        using (bucket_id = 'documentos' and pode_alterar_caminho_documento(name))
    $p$;
  end if;
end $$;
