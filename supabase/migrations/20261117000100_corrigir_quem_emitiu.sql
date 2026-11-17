-- Corrigir cálculo emitido (17/11/2026).
--
-- Processo emitido só volta a rascunho ("Corrigir") por quem emitiu a última versão (documento.criado_por do pacote
-- completo de maior versão). Antes: quem criou o processo ou o Admin. Em rascunho, continua: qualquer usuário ativo
-- altera; o Admin (Ordenador de Despesas) não emite (gatilho manter_criador_processo).

-- usuário que emitiu a última versão do processo (null se nunca foi emitido)
create or replace function emissor_do_processo(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select d.criado_por from documento d
  where d.processo_id = pid and d.tipo = 'pacote_completo'
  order by d.versao desc limit 1
$$;

revoke all on function emissor_do_processo(uuid) from public;
grant execute on function emissor_do_processo(uuid) to authenticated;

drop policy if exists processo_alterar on processo;
create policy processo_alterar on processo for update to authenticated
  using (eh_usuario_ativo() and (situacao = 'rascunho' or emissor_do_processo(id) = auth.uid()))
  with check (eh_usuario_ativo());
