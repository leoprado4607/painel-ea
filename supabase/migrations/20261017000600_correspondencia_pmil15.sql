-- P Mil 1,5%: SIAPPES Z05 "P MIL 1.5%" = SIPPES ND0005 "PENSAO MILITAR 1,5%" (catálogos oficiais, set/2026).
-- Obs.: a planilha rotula esta rubrica como "Z02 - P MIL 1,5%", mas no SIAPPES o código é Z05 (Z02 é a P Mil 10,5%).
insert into correspondencia_rubrica (codigo_rubrica, codigo_sippes, observacao)
values ('Z02 - P MIL 1,5%', 'ND0005', 'PENSAO MILITAR 1,5% (SIAPPES Z05)');
