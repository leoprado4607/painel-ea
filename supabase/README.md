# Banco de dados (Supabase)

## O que tem aqui

| Arquivo | Conteúdo |
|---|---|
| `migrations/…0100_esquema.sql` | Tabelas: OM, perfis, índices, regra de vigência, militares, processos, rubricas, lançamentos, documentos e auditoria. Gatilhos: processo emitido fica travado, auditoria automática. |
| `migrations/…0200_seguranca.sql` | Row Level Security. Cada OM só vê os próprios dados; o gestor administra os usuários da OM; o admin do sistema não lê dados pessoais. Bucket privado `documentos`. |
| `migrations/…0300_dados_iniciais.sql` | Rubricas padrão, regra de vigência do índice e séries **IPCA** e **IPCA-E** de out/2000 a set/2026 (gerado por `tools/ipca/gerar-dados-iniciais.ts`). |
| `migrations/…0400_agendamento.sql` | pg_cron chama a Edge Function `coletar-ipca` todo dia às 09:00 (Brasília); view `situacao_indices` indica coleta atrasada. |
| `migrations/…19000100_acesso_cpf.sql` | Reajustes de 19/10/2026: só Admin e Operador, CPF no perfil, todos os usuários ativos acessam todos os processos e `vincular_cpf_ao_login(email, cpf)` (roda só pelo SQL Editor) para converter logins antigos. |
| `migrations/…19000200_complementos.sql` | Coluna `processo.complementos` (jsonb): textos editáveis dos documentos (anexos, amparo, explicação, parecer, pensão judicial, operador CPEX). |
| `migrations/…19000400_exclusao_processo.sql` | Só o Admin exclui processos e militares (políticas separadas por operação); a trava de processo emitido deixa passar a exclusão em cascata. |
| `functions/gerenciar-usuarios` | O Admin cadastra (por CPF), desativa, reativa, redefine o acesso e exclui operadores. Verify JWT **ligado**. |
| `functions/coletar-ipca` | Busca os meses novos (IBGE e Banco Central, com fonte reserva), grava e registra cada execução em `coleta_indice`. |
| `tests/banco.test.ts` | Roda as migrações num PostgreSQL local (PGlite) e testa isolamento entre OMs, travas e a série composta. |

## Situação atual (17/10/2026)

Aplicado no projeto **painel-ea** (ref `brwvgjxdmldlqlduspbq`, região São Paulo), pelo **SQL Editor do painel**, sem a CLI:
as 4 migrações foram coladas e conferidas pelo hash SHA-256 de cada arquivo. A função `coletar-ipca` foi publicada pelo editor do
painel a partir de `tools/supabase/coletar-ipca.bundle.ts` (gerado por `tools/supabase/empacotar-funcao.sh`), com
"Verify JWT" desligado. O agendamento diário está ativo, e `configuracao.url_projeto` foi preenchida.

Como as migrações não passaram pela CLI, a tabela de histórico da CLI está vazia. Se um dia usar `supabase db push`, rode antes
`npx supabase migration repair --status applied 20261017000100 20261017000200 20261017000300 20261017000400`.

## Como subir no seu Supabase (uma vez)

Os comandos abaixo pedem login e chaves. Faça você mesmo, no terminal desta pasta; nenhuma chave deve ser colada em arquivo do projeto.

1. No painel do Supabase, crie um projeto na região **South America (São Paulo)**.
2. Entre na CLI (abre o navegador):
   ```bash
   npx supabase login
   ```
3. Ligue esta pasta ao projeto (o "ref" aparece na URL do painel):
   ```bash
   npx supabase link --project-ref SEU_REF
   ```
4. Crie as tabelas e carregue os dados:
   ```bash
   npx supabase db push
   ```
5. Publique a função de coleta:
   ```bash
   npx supabase functions deploy coletar-ipca
   ```
6. No painel, abra o **SQL Editor** e informe a URL do projeto (não é segredo; a função de coleta não exige chave):
   ```sql
   insert into configuracao (chave, valor) values ('url_projeto', 'https://SEU_REF.supabase.co');
   ```
7. Para conferir, rode a coleta uma vez pelo SQL Editor e veja o resultado:
   ```sql
   select * from cron.job;                                   -- deve listar 'coletar-ipca-diario'
   select * from situacao_indices;                           -- último mês de cada série
   select * from coleta_indice order by executada_em desc;   -- log das execuções
   ```

## Testes locais

```bash
npm test
```
