-- Fase D (19/10/2026): OM de vinculação (órgão pagador) lida do contracheque, no cadastro do favorecido.
-- Os PDFs de contracheque e fichas não são mais guardados: só os dados extraídos ficam no banco.
alter table militar add column if not exists om_vinculacao text;
