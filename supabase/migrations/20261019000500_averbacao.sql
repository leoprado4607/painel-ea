-- Averbação do direito (19/10/2026): de 2 campos (Nº BI/Adt e data) para documento, Nr Adt, Nr BI/BAR, OM e data.
-- bi_numero passa a ser o "Nr BI/BAR" (3 dígitos) e bi_data a "Data averbação".
alter table processo add column if not exists documento_averbacao text check (documento_averbacao in ('BI', 'Adt', 'BAR'));
alter table processo add column if not exists adt_numero text;       -- só quando o documento é "Adt"
alter table processo add column if not exists om_averbacao text;
