-- Gestão de usuários pela OM: e-mail no perfil (para a lista do gestor) e troca obrigatória da senha provisória.
-- A criação do login (auth.users) é feita pela Edge Function gerenciar-usuarios, com a service role.

alter table perfil add column if not exists email text;
alter table perfil add column if not exists trocar_senha boolean not null default false;

-- O próprio usuário marca que já trocou a senha provisória (ele não tem permissão para editar o resto do perfil).
create or replace function concluir_troca_senha() returns void
language sql security definer set search_path = public as $$
  update perfil set trocar_senha = false where usuario_id = auth.uid();
$$;
revoke all on function concluir_troca_senha() from public;
grant execute on function concluir_troca_senha() to authenticated;

-- E-mail dos perfis já existentes.
update perfil p set email = u.email from auth.users u where u.id = p.usuario_id and p.email is null;
