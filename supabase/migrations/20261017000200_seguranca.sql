-- Painel EA: Row Level Security.
-- Regras: cada OM só enxerga e altera os próprios dados; o gestor da OM administra os usuários da OM;
-- o admin do sistema cadastra OMs, rubricas padrão e acompanha os índices, mas NÃO lê dados pessoais
-- (militar, processo, lançamentos, documentos).

create function minha_om() returns uuid language sql stable security definer set search_path = public as $$
  select om_id from perfil where usuario_id = auth.uid() and ativo
$$;
create function meu_papel() returns papel_usuario language sql stable security definer set search_path = public as $$
  select papel from perfil where usuario_id = auth.uid() and ativo
$$;
create function eh_admin() returns boolean language sql stable as $$ select coalesce(meu_papel() = 'admin', false) $$;
create function eh_da_minha_om(alvo uuid) returns boolean language sql stable as $$
  select alvo is not null and alvo = minha_om() and meu_papel() in ('operador', 'gestor')
$$;
create function processo_da_minha_om(pid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from processo p where p.id = pid and p.om_id = minha_om()) and meu_papel() in ('operador', 'gestor')
$$;

alter table om enable row level security;
alter table perfil enable row level security;
alter table indice_mensal enable row level security;
alter table regra_indice enable row level security;
alter table coleta_indice enable row level security;
alter table rubrica_padrao enable row level security;
alter table militar enable row level security;
alter table processo enable row level security;
alter table processo_rubrica enable row level security;
alter table documento enable row level security;
alter table lancamento enable row level security;
alter table auditoria enable row level security;

-- OM: a própria OM (leitura; gestor edita os dados de assinatura); admin gerencia todas.
create policy om_ler on om for select to authenticated using (id = minha_om() or eh_admin());
create policy om_gestor_editar on om for update to authenticated
  using (id = minha_om() and meu_papel() = 'gestor') with check (id = minha_om());
create policy om_admin on om for all to authenticated using (eh_admin()) with check (eh_admin());

-- Perfis: cada um lê o seu; gestor gerencia operadores/gestores da OM; admin gerencia todos.
create policy perfil_proprio on perfil for select to authenticated using (usuario_id = auth.uid());
create policy perfil_gestor on perfil for all to authenticated
  using (meu_papel() = 'gestor' and om_id = minha_om())
  with check (meu_papel() = 'gestor' and om_id = minha_om() and papel in ('operador', 'gestor'));
create policy perfil_admin on perfil for all to authenticated using (eh_admin()) with check (eh_admin());

-- Índices, regra, rubricas padrão: todos leem; só admin altera (a coleta usa a service role).
create policy indice_ler on indice_mensal for select to authenticated using (true);
create policy indice_admin on indice_mensal for all to authenticated using (eh_admin()) with check (eh_admin());
create policy regra_ler on regra_indice for select to authenticated using (true);
create policy regra_admin on regra_indice for all to authenticated using (eh_admin()) with check (eh_admin());
create policy coleta_ler on coleta_indice for select to authenticated using (true);
create policy rubrica_padrao_ler on rubrica_padrao for select to authenticated using (true);
create policy rubrica_padrao_admin on rubrica_padrao for all to authenticated using (eh_admin()) with check (eh_admin());

-- Dados dos processos: só a OM dona (operador ou gestor).
create policy militar_om on militar for all to authenticated using (eh_da_minha_om(om_id)) with check (eh_da_minha_om(om_id));
create policy processo_om on processo for all to authenticated using (eh_da_minha_om(om_id)) with check (eh_da_minha_om(om_id));
create policy documento_om on documento for all to authenticated
  using (eh_da_minha_om(om_id)) with check (eh_da_minha_om(om_id) and processo_da_minha_om(processo_id));
create policy processo_rubrica_om on processo_rubrica for all to authenticated
  using (processo_da_minha_om(processo_id)) with check (processo_da_minha_om(processo_id));
create policy lancamento_om on lancamento for all to authenticated
  using (processo_da_minha_om(processo_id)) with check (processo_da_minha_om(processo_id));

-- Auditoria: gestor lê a da própria OM; ninguém altera (só os gatilhos, como security definer).
create policy auditoria_gestor on auditoria for select to authenticated using (meu_papel() = 'gestor' and om_id = minha_om());

-- Processo não pode trocar de OM, e o militar precisa ser da mesma OM.
create function conferir_om_processo() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.om_id <> old.om_id then raise exception 'processo não pode mudar de OM'; end if;
  if not exists (select 1 from militar m where m.id = new.militar_id and m.om_id = new.om_id) then
    raise exception 'militar não pertence à OM do processo';
  end if;
  return new;
end $$;
create trigger processo_om_coerente before insert or update on processo for each row execute function conferir_om_processo();

-- Storage: bucket privado "documentos", caminho <om_id>/<processo_id>/<arquivo>.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false) on conflict (id) do nothing;
    execute $p$
      create policy documentos_om on storage.objects for all to authenticated
        using (bucket_id = 'documentos' and (storage.foldername(name))[1] = minha_om()::text and meu_papel() in ('operador','gestor'))
        with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = minha_om()::text and meu_papel() in ('operador','gestor'))
    $p$;
  end if;
end $$;
