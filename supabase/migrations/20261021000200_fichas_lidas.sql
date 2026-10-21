-- Números lidos das fichas financeiras (21/10/2026).
--
-- Os PDFs continuam descartados; o processo guarda só as linhas de RECEITA lidas das fichas (código, descrição e os 12
-- meses de cada ano), para preencher sozinho os valores recebidos das rubricas de receita escolhidas em "Códigos
-- lançamento", dentro do período da dívida, quando as rubricas ou o período mudarem. Despesas não vêm das fichas.
-- Formato: [{ "ano": 2025, "sistema": "sippes", "linhas": [{ "codigo": "NR0001", "descricao": "SOLDO", "meses": [12 números] }] }]

alter table processo add column if not exists fichas_lidas jsonb not null default '[]'::jsonb;
