-- Reajustes de 19/10/2026: só dois papéis (Admin e Operador), login por CPF e acesso de todos a todos os processos.
-- Substitui o isolamento por OM e o papel "gestor" da migração 0200.
--
-- Login por CPF: o Supabase Auth só entra por e-mail ou telefone. Cada usuário recebe um e-mail técnico
-- "<11 dígitos do CPF>@cpf.painel-ea.local", que nunca recebe mensagens; a pessoa digita só o CPF.

-- ---------------------------------------------------------------- papéis
-- O enum mantém o valor 'gestor' (o Postgres não remove valores de enum), mas a restrição impede o uso.
update perfil set papel = 'operador' where papel = 'gestor';
alter table perfil add constraint perfil_papel_valido check (papel in ('operador', 'admin'));

-- ---------------------------------------------------------------- CPF e exclusão
alter table perfil add column if not exists cpf text check (cpf ~ '^\d{11}$');
alter table perfil add column if not exists excluido_em timestamptz;
-- O mesmo CPF pode ser cadastrado de novo depois de uma exclusão.
create unique index if not exists perfil_cpf_unico on perfil (cpf) where excluido_em is null;

-- ---------------------------------------------------------------- funções de acesso
create or replace function eh_usuario_ativo() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfil where usuario_id = auth.uid() and ativo and excluido_em is null and papel in ('operador', 'admin'))
$$;
create or replace function eh_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfil where usuario_id = auth.uid() and ativo and excluido_em is null and papel = 'admin')
$$;

-- ---------------------------------------------------------------- políticas
drop policy if exists om_ler on om;
drop policy if exists om_gestor_editar on om;
create policy om_ler on om for select to authenticated using (eh_usuario_ativo());
-- om_admin (for all, só admin) continua valendo.

drop policy if exists perfil_gestor on perfil;
-- perfil_proprio (cada um lê o seu) e perfil_admin (admin gerencia todos) continuam valendo.

drop policy if exists militar_om on militar;
drop policy if exists processo_om on processo;
drop policy if exists documento_om on documento;
drop policy if exists processo_rubrica_om on processo_rubrica;
drop policy if exists lancamento_om on lancamento;
create policy militar_todos on militar for all to authenticated using (eh_usuario_ativo()) with check (eh_usuario_ativo());
create policy processo_todos on processo for all to authenticated using (eh_usuario_ativo()) with check (eh_usuario_ativo());
create policy documento_todos on documento for all to authenticated using (eh_usuario_ativo()) with check (eh_usuario_ativo());
create policy processo_rubrica_todos on processo_rubrica for all to authenticated using (eh_usuario_ativo()) with check (eh_usuario_ativo());
create policy lancamento_todos on lancamento for all to authenticated using (eh_usuario_ativo()) with check (eh_usuario_ativo());

drop policy if exists auditoria_gestor on auditoria;
create policy auditoria_admin on auditoria for select to authenticated using (eh_admin());

-- Funções antigas, sem uso a partir daqui.
drop function if exists eh_da_minha_om(uuid);
drop function if exists processo_da_minha_om(uuid);

-- Storage: qualquer usuário ativo lê e grava no bucket "documentos" (o caminho continua <om_id>/<processo_id>/<arquivo>).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute 'drop policy if exists documentos_om on storage.objects';
    execute $p$
      create policy documentos_todos on storage.objects for all to authenticated
        using (bucket_id = 'documentos' and eh_usuario_ativo())
        with check (bucket_id = 'documentos' and eh_usuario_ativo())
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------- conversão dos usuários atuais
-- Liga um usuário que hoje entra por e-mail ao seu CPF: grava o CPF no perfil e troca o e-mail de login
-- pelo e-mail técnico. Roda só pelo SQL Editor do painel (sem permissão para o site).
create or replace function vincular_cpf_ao_login(email_atual text, cpf_novo text) returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  digitos text := regexp_replace(cpf_novo, '\D', '', 'g');
  login text := digitos || '@cpf.painel-ea.local';
  uid uuid;
begin
  if digitos !~ '^\d{11}$' then raise exception 'CPF deve ter 11 dígitos: %', cpf_novo; end if;
  select id into uid from auth.users where lower(email) = lower(trim(email_atual));
  if uid is null then raise exception 'nenhum usuário com o e-mail %', email_atual; end if;
  update perfil set cpf = digitos where usuario_id = uid;
  if not found then raise exception 'usuário % não tem perfil', email_atual; end if;
  update auth.users set email = login where id = uid;
  update auth.identities set identity_data = identity_data || jsonb_build_object('email', login)
    where user_id = uid and provider = 'email';
  return login;
end $$;
revoke all on function vincular_cpf_ao_login(text, text) from public, anon, authenticated;
