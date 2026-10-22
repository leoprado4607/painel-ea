-- Averbação por Adt (22/10/2026): todo Adt é parte de um BI ou de um BAR; a coluna guarda qual.
alter table processo add column if not exists adt_boletim text check (adt_boletim in ('BI', 'BAR'));  -- só quando o documento é "Adt"
