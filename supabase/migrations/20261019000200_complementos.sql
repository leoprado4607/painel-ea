-- Textos editáveis dos documentos (fase C, 19/10/2026), guardados por processo:
-- quantidades de anexos da Solicitação de Pagamento, amparo, explicação e parecer do Verso,
-- beneficiário da pensão judicial e operador que lança no sistema (folha CPEX).
-- Os valores e totais continuam sempre calculados; aqui ficam só textos e campos de preenchimento.
alter table processo add column if not exists complementos jsonb not null default '{}'::jsonb;
