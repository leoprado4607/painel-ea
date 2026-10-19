-- Painel EA: esquema principal.
-- Cada OM vê só os próprios dados (políticas na migração seguinte).


-- ---------------------------------------------------------------- tipos
create type papel_usuario as enum ('operador', 'gestor', 'admin');
create type tipo_rubrica as enum ('Receita', 'Despesa', '-');
create type tipo_lancamento as enum ('recebido', 'devido');
create type origem_lancamento as enum ('digitado', 'pdf', 'importado');
create type situacao_processo as enum ('rascunho', 'emitido', 'arquivado');
create type tipo_documento as enum (
  'ficha_financeira_pdf', 'planilha_importada',
  'solicitacao', 'solicitacao_verso', 'comprovacao_recebido', 'comprovacao_devido',
  'recapitulacao', 'cpex', 'resumo', 'pacote_completo'
);

-- ---------------------------------------------------------------- organização e usuários
create table om (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  regiao_militar text,                       -- "11ª"
  unidade_gestora text,                      -- UG
  codom text,
  cidade_uf text,
  ordenador_nome text, ordenador_funcao text default 'Ordenador de Despesas de Pagamento de Pessoal',
  fiscal_nome text, fiscal_funcao text default 'Fiscal Administrativo',
  chefe_pessoal_nome text, chefe_pessoal_funcao text default 'Chefe da Divisão de Pessoal',
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table perfil (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  om_id uuid references om (id),             -- null só para admin do sistema
  papel papel_usuario not null default 'operador',
  nome text not null,
  posto text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint perfil_om_obrigatoria check (papel = 'admin' or om_id is not null)
);

-- ---------------------------------------------------------------- índices de correção
create table indice_mensal (
  serie text not null check (serie in ('IPCA', 'IPCA-E')),
  ano int not null check (ano between 2000 and 2100),
  mes int not null check (mes between 1 and 12),
  percentual numeric(6, 2) not null,
  fonte text not null,
  coletado_em timestamptz not null default now(),
  primary key (serie, ano, mes)
);

-- Qual série corrige cada mês, a partir de quando. A composição alimenta o motor de cálculo.
create table regra_indice (
  vigencia_inicio date primary key check (extract(day from vigencia_inicio) = 1),
  serie text not null check (serie in ('IPCA', 'IPCA-E')),
  observacao text
);

-- Log de cada execução da coleta automática.
create table coleta_indice (
  id bigint generated always as identity primary key,
  executada_em timestamptz not null default now(),
  serie text not null,
  fonte text,
  situacao text not null check (situacao in ('ok', 'sem_novidade', 'erro')),
  meses_novos int not null default 0,
  revisoes jsonb not null default '[]',
  mensagem text
);

-- Rubricas sugeridas para novos processos (posições 1 a 17, como na aba "Códigos Lançamento").
create table rubrica_padrao (
  posicao int primary key check (posicao between 1 and 17),
  codigo text not null default '',
  tipo tipo_rubrica not null
);

-- ---------------------------------------------------------------- processos
create table militar (
  id uuid primary key default gen_random_uuid(),
  om_id uuid not null references om (id),
  posto_graduacao text,
  nome text not null,
  prec_cp text,
  identidade text,
  cpf text,
  banco text, agencia text, conta text,
  situacao text check (situacao in ('Ativa', 'Reintegrado', 'Ex-Militar', 'Veterano', 'Reformado', 'Pensionista')),
  criado_em timestamptz not null default now()
);
create index militar_om on militar (om_id);

create table processo (
  id uuid primary key default gen_random_uuid(),
  om_id uuid not null references om (id),
  militar_id uuid not null references militar (id),
  numero text,
  ano int,
  data_requerimento date,
  bi_numero text, bi_data date,
  especie_divida text,
  periodo_inicio date, periodo_fim date,
  data_solicitacao_extenso text,
  possui_pensao_judicial boolean not null default false,
  situacao situacao_processo not null default 'rascunho',
  -- Congelados na emissão: mês-base do índice e a série composta usada (reemissão reproduz o mesmo valor).
  indice_ate date,
  indices_usados jsonb,
  criado_por uuid references auth.users (id) default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (periodo_fim is null or periodo_inicio is null or periodo_fim >= periodo_inicio)
);
create index processo_om on processo (om_id);

create table processo_rubrica (
  processo_id uuid not null references processo (id) on delete cascade,
  posicao int not null check (posicao between 1 and 17),
  codigo text not null default '',
  tipo tipo_rubrica not null,
  primary key (processo_id, posicao)
);

create table documento (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references processo (id) on delete cascade,
  om_id uuid not null references om (id),
  tipo tipo_documento not null,
  ano int,
  caminho_storage text not null unique,      -- <om_id>/<processo_id>/<arquivo>
  sha256 text not null,
  tamanho_bytes bigint,
  indice_ate date,
  versao int not null default 1,
  criado_por uuid references auth.users (id) default auth.uid(),
  criado_em timestamptz not null default now()
);
create index documento_processo on documento (processo_id);

create table lancamento (
  processo_id uuid not null references processo (id) on delete cascade,
  tipo tipo_lancamento not null,
  ano int not null check (ano between 2000 and 2100),
  mes int not null check (mes between 1 and 12),
  posicao int not null check (posicao between 1 and 17),
  valor numeric(14, 2) not null,
  origem origem_lancamento not null default 'digitado',
  documento_id uuid references documento (id) on delete set null,  -- PDF de onde o valor foi lido
  primary key (processo_id, tipo, ano, mes, posicao)
);

create table auditoria (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  usuario_id uuid default auth.uid(),
  om_id uuid,
  tabela text not null,
  registro text,
  acao text not null,
  antes jsonb,
  depois jsonb
);
create index auditoria_om on auditoria (om_id, em desc);

-- ---------------------------------------------------------------- regras no banco
create function tocar_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger processo_atualizado before update on processo for each row execute function tocar_atualizado_em();

-- Processo emitido não muda: só volta a rascunho criando nova versão (decisão do sistema, não do banco).
create function bloquear_processo_emitido() returns trigger language plpgsql as $$
declare s situacao_processo;
begin
  select situacao into s from processo where id = coalesce(new.processo_id, old.processo_id);
  if s is distinct from 'rascunho' then
    raise exception 'processo % não está em rascunho (situação: %)', coalesce(new.processo_id, old.processo_id), s;
  end if;
  return coalesce(new, old);
end $$;
create trigger lancamento_so_rascunho before insert or update or delete on lancamento
  for each row execute function bloquear_processo_emitido();
create trigger rubrica_so_rascunho before insert or update or delete on processo_rubrica
  for each row execute function bloquear_processo_emitido();

-- Auditoria genérica.
create function auditar() returns trigger language plpgsql security definer set search_path = public as $$
declare
  linha jsonb := to_jsonb(coalesce(new, old));
  om uuid := coalesce((linha ->> 'om_id')::uuid,
                      (select p.om_id from processo p where p.id = (linha ->> 'processo_id')::uuid));
begin
  insert into auditoria (om_id, tabela, registro, acao, antes, depois)
  values (om, tg_table_name, coalesce(linha ->> 'id', linha ->> 'processo_id', linha ->> 'usuario_id'), tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
create trigger auditar_processo after insert or update or delete on processo for each row execute function auditar();
create trigger auditar_militar after insert or update or delete on militar for each row execute function auditar();
create trigger auditar_lancamento after insert or update or delete on lancamento for each row execute function auditar();
create trigger auditar_documento after insert or update or delete on documento for each row execute function auditar();
create trigger auditar_perfil after insert or update or delete on perfil for each row execute function auditar();

-- Série composta pela regra de vigência: um percentual por mês, da série vigente naquele mês.
create view indice_composto with (security_invoker = true) as
select i.ano, i.mes, i.percentual, i.serie
from indice_mensal i
where i.serie = (
  select r.serie from regra_indice r
  where r.vigencia_inicio <= make_date(i.ano, i.mes, 1)
  order by r.vigencia_inicio desc limit 1
);
