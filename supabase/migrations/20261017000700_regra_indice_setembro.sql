-- A própria planilha traz a nota "Valor corrigido pelo IPCA até o mês de agosto de 2025; IPCA-E a partir do mês de
-- setembro de 2025". Em set/2025 os dois índices foram iguais (0,48%), então o valor calculado não muda.
update regra_indice
set vigencia_inicio = '2025-09-01',
    observacao = 'IPCA-E a partir de set/2025 (nota da planilha; set/2025 tem o mesmo valor nos dois índices)'
where serie = 'IPCA-E' and vigencia_inicio = '2025-10-01';
update regra_indice set observacao = 'IPCA de out/2000 a ago/2025' where serie = 'IPCA' and vigencia_inicio = '2000-10-01';
