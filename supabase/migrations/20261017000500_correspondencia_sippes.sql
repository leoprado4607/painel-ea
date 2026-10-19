-- Correspondência entre os códigos da Ficha Financeira do SIPPES e as rubricas da planilha.
-- Usada para preencher os valores recebidos a partir dos PDFs. Ajustável pelo admin, sem mexer no código.
-- Z99 (pensão judiciária) e P Mil 1,5% ainda sem definição: a OM escolhe na tela de revisão do envio.

create table correspondencia_rubrica (
  codigo_rubrica text not null,   -- ex.: 'A01 - SOLDO' (como em rubrica_padrao / processo_rubrica)
  codigo_sippes text not null check (codigo_sippes ~ '^(NR|ND|AR|AD)[0-9]{4}$'),
  observacao text,
  primary key (codigo_sippes)
);

alter table correspondencia_rubrica enable row level security;
create policy correspondencia_ler on correspondencia_rubrica for select to authenticated using (true);
create policy correspondencia_admin on correspondencia_rubrica for all to authenticated using (eh_admin()) with check (eh_admin());

insert into correspondencia_rubrica (codigo_rubrica, codigo_sippes, observacao) values
  ('A01 - SOLDO', 'NR0001', 'SOLDO'),
  ('A03 - ADIC HAB', 'NR0003', 'ADICIONAL DE HABILITACAO'),
  ('A14 - ADIC MIL', 'NR0014', 'ADICIONAL MILITAR'),
  ('AL0 - ACDM', 'NR0170', 'AD C DISP MIL'),
  ('A85 - ADIC NATAL - 2ª P', 'NR0085', 'ADICIONAL NATAL 2PARC'),
  ('AD2 - ADICIONAL FÉRIAS', 'NR0092', 'ADICIONAL DE FERIAS'),
  ('Z01 - FUSEX', 'ND0001', 'FUSEX 3%'),
  ('Z02 - P MIL 7,5/9,5/10,5%', 'ND0002', 'PENSAO MILITAR - MILITAR CARREIRA'),
  ('ZM7 - DESC DEP FUSEX', 'ND0011', 'DESCONTO DEPENDENTE - FUSEX');
