# Planilha EA (Exercício Anterior): análise e plano de migração para site

Fonte analisada: `Planilha EA - MA - IPCA-E Set 26 - Atualizada 30 Set 26.xlsm` (2,8 MB).
Ferramentas: REA (extração do pacote) + leitura de fórmulas e macros (openpyxl/olevba).

---

## 1. O que a planilha é, por dentro

| Item | Quantidade |
|---|---|
| Abas | 111 (88 visíveis, 23 ocultas) |
| Fórmulas | ≈ 55.000 (IF 17,7 mil · VLOOKUP 5 mil · SUM 4,7 mil · SUMIFS 3 mil) |
| Formatações condicionais | ≈ 13.500 |
| Módulos VBA | 156 (só ≈ 40 macros com código real) |
| Formas e botões com macro | ≈ 290 (103 apontam para uma macro que não existe) |
| Documentos Word embutidos | 25 (um por aba "Solicitação", com uma figura) |
| Nomes definidos | 23 (Código1…Código17, RD_Códigos_Lançamento, Calculo_do_Acumulado etc.) |

Quase tudo é a mesma lógica copiada **23 vezes**, uma para cada ano de 2006 a 2028. As abas `Solicitação NN`, `Solicitação NN Verso`, `NN-Recebido` e `NN-Devido` se repetem por ano. No site, isso vira **uma regra só**, parametrizada pelo ano.

### Fluxo de dados

```
Cálculo do Acumulado (IPCA mensal) ─┐
Informações (OM, militar, período) ─┤
Códigos Lançamento (17 rubricas) ───┤
Contracheque - F Financeira ────────┼─► F Financeira-Corrigida ─┐
Lançar Valor Devido ────────────────┴─► Valor Devido-Corrigida ─┴─► Valor_Líquido_Corrigido
                                                                          │
                     Códigos-Anos (totais por rubrica × ano) ◄────────────┘
                                   │
     Solicitação NN / Verso / NN-Recebido / NN-Devido / Resumo / Recapitulação / CPEX ──► impressão
```

### Regras de negócio extraídas

0. **Precisão conforme exibido** (opção ligada no arquivo, `fullPrecision="0"`): o Excel guarda cada célula **já arredondada às casas do seu formato**. O cálculo arredonda o índice a 6 casas, o fator a 13 e cada valor em R$ a 2 casas, em cada etapa. O motor reproduz isso; sem esse arredondamento, os totais sairiam diferentes por centavos.
1. **Fator acumulado do IPCA** (`Cálculo do Acumulado`): para cada mês *m*,
   `fator(m) = Π (1 + IPCA_k/100)` para *k* de *m* até o último mês informado.
   `acumulado%(m) = fator(m) − 1`. Mês sem índice conta como fator 1.
   O "atualizado até" é o último mês com índice preenchido (hoje, Setembro/2026).
2. **Alerta**: na planilha, só os meses de jan/2022 a dez/2023 têm o aviso "ATENÇÃO VALOR ACIMA DO NORMAL" (acima de 2% e depois de 1,99%). No site, o aviso vale para qualquer mês acima de 1,99%.
3. **Correção de cada valor**: `corrigido = valor × acumulado%(mês) + valor`. Vale para o recebido e para o devido, mês a mês e rubrica a rubrica.
4. **Rubricas**: 17 posições configuráveis, cada uma marcada como Receita, Despesa ou "-". O padrão é A01 Soldo, A03 Adic Hab, A14 Adic Mil, AL0 ACDM, A85 Adic Natal 2ª P, AD2 Adic Férias, Z01 FUSEX, Z02 P Mil 7,5/9,5/10,5%, Z02 P Mil 1,5%, Z99 Pens Judiciária e ZM7 Desc Dep FUSEX.
5. **Total do contracheque** = Σ Receitas − Σ Despesas (SUMIFS por tipo).
6. **Líquido corrigido** = Devido corrigido − Recebido corrigido, por mês e rubrica. Os totais saem por ano e por tipo.
7. **Quatro visões por rubrica × ano** (`Códigos-Anos`): recebido sem correção, devido sem correção, devido − recebido sem correção, e devido − recebido com correção. A linha "TOTAL C/CHEQUE" de cada ano usa a **posição**, não o tipo: soma as posições 1–12 e subtrai as 13–17. Os totais gerais (AA/AB), que vão para a CPEX, usam o tipo Receita/Despesa.
8. **Importância básica** (Solicitação): `ROUND(total, 2)`, o único arredondamento explícito da planilha.
9. **Qtd. de meses da dívida** = (ano_fim − ano_ini) × 12 + (mês_fim − mês_ini) + 1.
10. **Validações de documentos** (`Informações`, colunas K–AP): dígito verificador do **Prec-CP** (pesos 1/2 alternados, completa até a dezena seguinte), do **CPF** (módulo 11, dois dígitos) e da **Identidade Militar** (quebrada na planilha; a regra inferida bateu com 2 identidades reais lidas das fichas financeiras).
11. **Analista CPEX** (aba oculta, *fora da 1ª versão*): calcula descontos sobre o devido de 2001 a 2022. FUSEX de 2,7% (2001–2005) ou de 3%, 3,4% ou 3,5% (2006 em diante), P Mil de 7,5% e de 1,5%, tudo corrigido pelo IPCA.
12. **Texto composto**: lista de despesas compactada ("Z01 - FUSEX / Z02 - …"), cabeçalhos com RM, OM, requerente, período e espécie, e assinaturas (OD, Fiscal Adm e Chefe da Div Pessoal).
13. **Listas**: bancos (001, 033, 041, 070, 104, 237, 341), situação do militar (Ativa, Reintegrado, Ex-Militar, Veterano, Reformado, Pensionista) e RM (1ª a 12ª).

### Macros (VBA)

Não há lógica de cálculo em VBA. As macros fazem só três coisas:
- **Imprimir** (≈ 30 macros): uma por ano, cada uma imprimindo Solicitação, Verso, Recebido e Devido daquele ano. Mais a impressão de Informações, Contracheque e Lançar Valor Devido.
- **Limpar campos** (Macro1/2/3/7/10): apagam intervalos de entrada.
- **Boas-vindas** ao abrir o arquivo.

No site, tudo isso vira "Gerar PDF do ano X / de todos os anos" e "Novo processo".

---

## 2. Problemas encontrados na planilha atual

| # | Problema | Impacto |
|---|---|---|
| P1 | **`Códigos-Anos` aponta para as linhas erradas em 2026, 2027 e 2028.** Exemplo: W4 (2026, recebido) soma a linha 406 do Contracheque, que pertence ao bloco de 2027. O certo é a linha 386. O mesmo acontece em X4/X24 (2027), Y4/Y24 (2028) e X80 (2027, com correção). | **Confirmado em todas as 17 rubricas**: o "recebido sem correção" de 2026 lê os valores de 2027. Para 2026 isso afeta as abas Códigos-Anos e CPEX (coluna "sem correção"). O valor corrigido usa outra cadeia, que está correta. Ao todo são 85 células erradas. |
| P2 | Totais gerais em `Códigos-Anos` (colunas AA e AB) somam **de 2008 em diante** (`SUM(E:Y)`) e deixam 2006 e 2007 de fora. Esses totais alimentam a aba **CPEX**. Já a **Solicitação Recapitulação** soma de 2006 a 2028. | Se houver valores em 2006 ou 2007, **o total da CPEX fica diferente do total da Recapitulação** no mesmo processo. **Decidido: manter como está.** O site vai reproduzir: CPEX soma de 2008 em diante e Recapitulação soma todos os anos. |
| P3 | **O índice tem rótulo de IPCA-E, mas os valores são do IPCA.** Exemplo: jan/2025 = 0,16 e fev/2025 = 1,31 batem com o IPCA, não com o IPCA-E. O nome do arquivo e o texto da aba CPEX dizem "IPCA-E"; o Passo a Passo diz "IPCA (Calculadora do Cidadão)". | **Revisto após o P15:** IPCA até set/2025 e IPCA-E a partir de out/2025. No site, os textos dirão "corrigido pelo IPCA (até set/2025) e IPCA-E (a partir de out/2025)". |
| P4 | 103 botões chamam a macro `Anterior`, **que não existe** no projeto VBA. | Erro ao clicar e sensação de que "a planilha não funciona". |
| P5 | `Informações!AJ22` contém `MID(#REF!,…)` e `NN-Recebido!N7 = #REF!`. | Validação da Identidade Militar quebrada. |
| P6 | `NN-Recebido!K5` ("Importância Básica") aponta para `Informações!B16`, que é o "Ano do Processo". | Valor errado no impresso. |
| P7 | Senha de proteção escrita numa célula ("Senha: 123", aba Analista CPEX). | A proteção é só cosmética. |
| P8 | Atualizar o ano é **manual**: copiar e colar blocos e ocultar e reexibir anos (aba `Atualização_Planilha`). | É a origem dos erros como o P1. |
| P9 | **Resumo**: o TOTAL LÍQUIDO de 2008 mostra 2010 e o de 2011 mostra 2013. Os blocos de **2016 e 2018 estão deslocados uma linha** (cada rubrica mostra a vizinha). A coluna de "2029" repete 2025. | Resumo impresso errado nesses anos. |
| P10 | **06/07-Recebido e 06/07-Devido** corrigem os valores de 2006 e 2007 com os **índices de 2008**. | Folhas de comprovação de 2006/2007 com valores corrigidos a menor. Os totais oficiais usam outra cadeia, que está correta. |
| P11 | **Solicitação 06**: a coluna "com correção" das rubricas 2 a 17 vem da **Verso de 2007**, assim como o total e a importância básica. | Solicitação de 2006 errada sempre que 2006 ou 2007 tiverem valores. |
| P12 | **Solicitação 06 Verso e 07 Verso**: o TOTAL corrigido (G32) vem do **ano de 2008**. | Total do verso de 2006/2007 errado. |
| P13 | **Solicitação 28 Verso**: devido e recebido sem correção vêm de **2027**. | Ano futuro e oculto; baixo impacto hoje. |
| P14 | **F Financeira-Corrigida!D311** e **21-Recebido!F13**: **fevereiro/2021 da rubrica 6 (Adicional de Férias) lê o valor de julho/2021**. | **Afeta valores reais**: quando há adicional de férias em julho/2021, o recebido corrigido conta esse valor duas vezes (fevereiro e julho). Isso reduz a diferença a receber em 2021, na CPEX e na Recapitulação. **Processos já emitidos com 2021 podem ter saído com valor a menor.** |

| P15 | **A série de índices mistura dois índices.** De out/2000 a set/2025 os valores são do **IPCA** (300 meses idênticos ao IBGE). De **out/2025 a set/2026** os 12 meses são do **IPCA-E** (iguais ao IPCA-15 do IBGE e à série 10764 do Banco Central), e não do IPCA. Exemplo: mar/2026 está 0,44 (IPCA-E); o IPCA foi 0,88. | Muda o fator acumulado de todos os meses anteriores. **Decidido: manter a regra da planilha** (IPCA até set/2025, IPCA-E a partir de out/2025). O nome do arquivo e o texto da CPEX passam a fazer sentido; os textos do site devem citar os dois índices e o mês da troca. |

Lista gerada pela auditoria automática (`tools/golden/auditar_estrutura.py`), que compara cada uma das fórmulas de cálculo com a fórmula esperada para a sua posição. O motor calcula o valor **correto** nesses pontos. Os testes confirmam que as diferenças em relação à planilha aparecem só nessas regiões.

### Por que dá incompatibilidade entre computadores

- O `.xlsm` baixado da internet ou do e-mail tem as **macros bloqueadas pelo Windows** (Mark of the Web).
- Há **25 objetos Word (OLE) embutidos** e **47 controles de formulário**, que não funcionam no Excel Online, no Mac, no LibreOffice nem em versões antigas.
- Há **108 configurações de impressora** gravadas no arquivo, presas às impressoras de quem salvou.
- A planilha é pesada: 55 mil fórmulas, 13,5 mil formatações condicionais e `styles.xml` de 1,7 MB (estilos inchados), o que a deixa lenta e instável.
- Os botões estão quebrados (P4).

---

## 3. Arquitetura proposta

```
Navegador (qualquer computador)
   │  login
   ▼
Aplicação web ──► Motor de cálculo (regras 1–12, testado contra a planilha)
   │                 │
   │                 ▼
   ├──► Banco de dados (processos, lançamentos, índices, documentos, auditoria)
   ├──► Gerador de PDF (Solicitação, Verso, Recebido, Devido, Recapitulação, CPEX, Resumo)
   └──► Rotina diária (pg_cron): busca o IPCA no IBGE (API SIDRA) e grava no banco
```

**Pilha definida: Next.js (TypeScript) + Supabase** (decisão de 17/10/2026; o usuário já tem conta no Supabase). Supabase fornece PostgreSQL com isolamento por OM (Row Level Security), login com 2FA (Supabase Auth), armazenamento criptografado dos PDFs (Storage) e agendamento da coleta do IPCA (pg_cron + Edge Function). Projeto criado na região **São Paulo**. Hospedagem do site: Vercel (região São Paulo) ou similar. PDFs gerados a partir de HTML/CSS. Leitura dos `.xlsm` antigos com SheetJS.

### Banco de dados (resumo)

- `indice_mensal` (série, mês, valor, fonte, data de coleta)
- `om`, `militar` (posto, nome, Prec-CP, identidade, CPF, banco, agência, conta, situação)
- `rubrica` (código, descrição, Receita/Despesa, ativa) e `processo_rubrica` (as até 17 rubricas escolhidas no processo)
- `processo` (OM, militar, nº e ano do processo, BI, datas, espécie, período início e fim, status, **índice e mês-base congelados ao emitir**)
- `lancamento` (processo, ano, mês, rubrica, tipo recebido/devido, valor)
- `documento_gerado` (processo, tipo, ano, PDF, hash SHA-256, versão do índice, usuário, data)
- `auditoria` (quem alterou o quê e quando)

Isso cria o **banco de dados dos arquivos gerados**: cada PDF fica guardado com os dados que o produziram e pode ser reemitido ou recalculado com um IPCA mais novo.

### Atualização automática do IPCA

- Fontes, conferidas entre si em toda a série: **IPCA** no IBGE/SIDRA (tabela 1737), com reserva no Banco Central (SGS 433); **IPCA-E** no Banco Central (SGS 10764), com reserva no IBGE/SIDRA (tabela 3065, IPCA-15). O banco guarda as duas séries, e a tabela `regra_indice` define qual corrige cada mês.
- A rotina roda todo dia. Quando sai um mês novo, ela grava o índice, aplica o alerta da regra 2 e mostra "IPCA atualizado até <mês>".
- Um processo emitido **fica congelado** no índice usado. Um botão "Atualizar para o IPCA mais recente" recalcula e gera uma nova versão.
- Os anos ficam dinâmicos: não é mais preciso criar blocos nem abas a cada ano (fim do P8).

---

## 4. Plano em fases

| Fase | Entrega | Critério de pronto |
|---|---|---|
| **0. Decisões e amostras** | Respostas às perguntas da seção 5. Dois ou três processos reais já calculados na planilha, com dados pessoais trocados. | Casos de teste definidos. |
| **1. Motor de cálculo** ✅ *(concluída em 17/10/2026)* | Biblioteca com as regras 1–10 e 12 (a 11, Analista CPEX, fica fora da 1ª versão), sem tela. Livro-razão regra → fórmula de origem (REA `build_reconstruction_obligation_ledger`). | **Bate ao centavo** com a planilha nos casos de teste, em todas as células de saída. Divergências só onde a planilha está errada (P1, P5, P6), documentadas. |
| **2. Banco e IPCA** ✅ *(17/10/2026: aplicado no projeto Supabase painel-ea, região São Paulo; coleta diária ativa e testada)* | Esquema do banco, carga da série histórica (out/2000 em diante) e rotina diária de coleta. | Série do banco igual à da planilha até set/2026; próximo mês coletado sozinho. |
| **3. Telas** ✅ *(17/10/2026: login com 2FA, processos em 5 etapas, conferência, "Dados da OM" e "Usuários". O gestor cria operadores e gestores com senha provisória, mostrada uma vez, e troca obrigatória no 1º acesso; também desativa, reativa e muda papel, tudo pela Edge Function `gerenciar-usuarios` e com auditoria. Testado no Supabase real)* | **Página com campos de preenchimento, sem aparência de planilha.** Assistente em etapas, igual ao Passo a Passo: Dados do militar → Período e espécie da dívida → Rubricas → Valores recebidos → Valores devidos → Conferência. Os **valores recebidos** vêm da leitura dos PDFs (fase 5); a digitação manual fica só como alternativa. Nos valores devidos, a OM escolhe ano e mês e preenche um campo por rubrica (rótulo, tipo Receita/Despesa e máscara R$). Atalhos: "copiar do mês anterior" e "repetir este valor de <mês> até <mês>", para evitar redigitação. Validação de Prec-CP, Identidade e CPF na hora da digitação, com mensagem clara. Os dados da OM vêm do cadastro. A conferência mostra os totais por ano antes de gerar os documentos. | Um operador refaz um processo real sem ajuda e sem ver nenhuma grade de planilha. |
| **4. Documentos** ✅ *(17/10/2026)* | Pacote completo em PDF (`packages/documentos`, com @react-pdf/renderer): por ano, Solicitação, Verso, Comprovação do recebido e do devido; depois Recapitulação, CPEX e Resumo, com brasão e assinaturas da tela "Dados da OM". "Ver prévia" (rascunho) e "Emitir": o PDF fica guardado no Storage com hash SHA-256, versão e índice usado, e o processo é travado com os 312 meses de índice congelados. "Reabrir para correção" gera nova versão. Testado ponta a ponta: o PDF emitido do caso nº 1 tem os mesmos valores da planilha, e o hash baixado confere com o do banco. **Diferenças intencionais em relação aos impressos da planilha:** (1) Recapitulação e Resumo mostram só os anos do período da dívida; (2) os textos citam "IPCA até ago/2025 e IPCA-E a partir de set/2025"; (3) os valores dos pontos com erro de fórmula (P9–P14) saem corretos; (4) sem os botões "Anterior/Próximo"; (5) rodapé de rastreabilidade em todas as páginas; (6) na CPEX, os dados do beneficiário da pensão judicial ficam em linhas para preencher à mão (ainda não há campos no cadastro). | Conferência visual pelo CPEx/OM. |
| **5. Leitura de PDFs e importador** 🟡 *(17/10/2026: leitor da Ficha Financeira do SIPPES pronto (`packages/leitor-ficha`) e ligado ao site. "Criar processo pelas fichas" testado com ficha real: militar, período e 9 rubricas preenchidos, batendo ao centavo com os totais da ficha; PDF guardado no Storage da OM. Correspondência SIPPES↔SIAPPES montada a partir dos catálogos oficiais (`tools/rubricas`). Falta: definir Z99 e o importador de `.xlsm` antigos)* | **Upload de PDFs das fichas financeiras/contracheques: o site lê o arquivo e preenche sozinho os dados do militar (nome, CPF, Prec-CP, identidade) e os valores recebidos** (ano, mês, rubrica, valor), sem digitação. A OM só confere numa tela de revisão, que destaca o que não foi reconhecido com segurança, e confirma. O PDF original fica guardado junto ao processo. Também lê planilhas `.xlsm` antigas já preenchidas (importador exclusivo do Administrador, sem acesso dele aos dados pessoais). | Para PDFs de teste, todos os valores lidos batem com o documento, e o que não for reconhecido é sinalizado (nunca preenchido em silêncio). |
| **6. Segurança e implantação** 🟡 *(17/10/2026: publicado em **https://painel-ea.vercel.app**, projeto Vercel `painel-ea` do time Leo's projects, região São Paulo/gru1, HTTPS com HSTS, páginas internas exigem login + 2FA. Publicar de novo: `npx vercel@62.2.0 deploy --prod --scope leos-projects-c696e1d6` na raiz. Falta: domínio próprio, se desejado, e aprovação da TI)* | Login, perfis (Operador da OM, Gestor da OM, Administrador do sistema), isolamento de dados por OM, trilha de auditoria, backup e LGPD (CPF e dados bancários). Hospedagem em nuvem com região Brasil (ver seção 5). | Aprovação da TI responsável. |
| **7. Operação paralela** | Um ou dois meses usando site e planilha juntos, conferindo os resultados. | Zero divergência não explicada. Desativar a planilha. |

A ordem garante que nada se perca: **o motor é provado contra a planilha (fase 1) antes de existir qualquer tela.**

---

## 5. Decisões

**Já decidido**
- Índice: **IPCA até set/2025 e IPCA-E a partir de out/2025**, como a planilha faz hoje (17/10/2026, revisão da decisão anterior após o P15). A coleta diária mantém as duas séries; a regra fica na tabela `regra_indice`.
- Hospedagem: **nuvem** (17/10/2026). Requisitos que isso traz, por causa de CPF, Prec-CP e dados bancários (LGPD):
  - dados guardados em região no Brasil (ex.: São Paulo);
  - HTTPS obrigatório, banco e PDFs criptografados em repouso, backups diários;
  - login com senha forte e segundo fator (2FA), perfis por OM e trilha de auditoria;
  - acesso administrativo restrito e registrado;
  - conferir com a TI e o encarregado de dados da OM se há norma interna exigindo aprovação para uso de nuvem.
- Usuários: **somente as OMs** (17/10/2026). Cada OM vê e edita apenas os próprios processos; o CPEx não acessa o site e continua recebendo os documentos gerados (formulário CPEX, Solicitação etc.) pelo trâmite atual.
  - Perfis: **Operador da OM** (lança e gera documentos), **Chefe/Gestor da OM** (cadastra operadores da sua OM, vê todos os processos dela) e **Administrador do sistema** (cadastra OMs, mantém rubricas padrão e acompanha a coleta do IPCA; não vê dados pessoais dos processos).
  - Dados da OM (nome, RM, UG, CODOM, cidade, OD, Fiscal Adm, Chefe da Div Pessoal) ficam no cadastro da OM e preenchem os processos automaticamente.
- Aba **Analista CPEX**: **fora da 1ª versão** (17/10/2026). Ela é uma calculadora isolada (nenhuma aba usa seus resultados), está vazia e parou em 2022. Possível evolução: botão opcional "calcular FUSEX e P Mil automaticamente" na tela de valores devidos, depois de confirmar as alíquotas por período (hoje a aba usa P Mil fixa de 7,5%).
- Totais da CPEX (P2): **manter como a planilha** (17/10/2026). A CPEX soma de 2008 em diante e a Recapitulação soma 2006–2028. O motor reproduz exatamente isso, e a regra fica isolada num único parâmetro ("ano inicial dos totais da CPEX = 2008") para ser alterada se um dia mudar.
- Tecnologia: **Next.js + Supabase** (17/10/2026), região São Paulo.
- Interface: **formulário com campos**, não grade de planilha (17/10/2026).
- Correspondência de códigos: confirmada pelos catálogos oficiais (SIAPPES Tab_pag set/26 e lista de rubricas do SIPPES). P Mil 1,5% = SIAPPES **Z05** = SIPPES **ND0005**; a planilha a rotula, por engano, como "Z02".
- Valores recebidos **e dados do militar (nome, CPF, Prec-CP e identidade)**: **extraídos automaticamente das fichas financeiras em PDF enviadas pela OM** (17/10/2026). O processo começa pelo envio dos PDFs; os campos ficam para conferência e correção. Preciso de 2 ou 3 PDFs de exemplo (fichas financeiras reais com dados pessoais tarjados) para construir o leitor.

- Importador de `.xlsm`: **só o Administrador usa, e importa "às cegas"** (17/10/2026). Ele escolhe a OM e envia as planilhas. Uma função protegida do banco cria os processos direto na OM, e o admin vê só um resumo sem dados pessoais (quantidade importada e quantas com divergência). A OM confere cada processo importado, com a comparação "planilha × site" e a indicação de qual erro da planilha explica cada diferença.

**Reajustes de 19/10/2026 (substituem as decisões de usuários e acesso acima)**
- Papéis: só **Admin** e **Operador**. O papel Gestor deixou de existir (os gestores viraram operadores).
- **Login por CPF** (Admin e operadores). Por trás, cada usuário tem o e-mail técnico `<CPF>@cpf.painel-ea.local`, que nunca recebe mensagens. Sem e-mail não há "esqueci a senha": o Admin usa "Redefinir acesso", que gera uma nova senha provisória e apaga o autenticador.
- **Autenticador (2FA) desligado por enquanto** (19/10/2026, pedido do usuário): login só com CPF e senha. A tela /mfa e o cadastro de fatores continuam no código para religar (middleware e redirecionamento do login).
- **Admin e operadores veem e editam todos os processos**, de qualquer OM. O isolamento por OM foi revogado, e a auditoria passa a ser o controle de quem alterou o quê.
- Painel **Operadores** (`/operadores`), exclusivo do Admin: cadastra (CPF, nome, posto, OM), desativa, reativa, redefine o acesso e exclui. A exclusão apaga o login; se o operador já tiver registros, o login é bloqueado e o perfil é marcado como excluído (o CPF fica livre para novo cadastro).
- Dados da OM: só o Admin altera. Fiscal Adm e Chefe da Div Pessoal **saem dos documentos**, e as assinaturas deles passam a ser do **Auxiliar Div Pg Pes** (o operador que gera o PDF; posto e nome vêm do cadastro dele). ✅ *(fase B, 19/10/2026; as colunas fiscal_* e chefe_pessoal_* continuam no banco, sem uso)*
- **Navegação por abas no rodapé**, no estilo do Excel ✅ *(fase C, 19/10/2026)*: Passo a passo · Atualização do IPCA-E (botão "Buscar índices agora") · Dados da OM · Operadores (só Admin) · Dados do favorecido · Códigos lançamento · Contracheque - F Financeira · Lançar valor devido · Solicitação · Solicitação verso · CPEX · Recapitulação · Impressão · Resumo · Exercícios por ano (as 92 abas anuais viraram uma aba com seletor de ano). A cor da aba indica o grupo: cinza (sistema), verde (lançamentos), latão (documentos). Cada aba de documento tem os campos editáveis ao lado da prévia em PDF; os textos ficam em `processo.complementos` e os valores são sempre recalculados.
- **Folha de rosto** (abas "Solicitação" e "Solicitação Verso" da planilha), que faltava no site: Solicitação de Pagamento ao OD, com anexos, quadro "Reservado ao OD", tabela do interessado e observação do índice; verso com requerimento, documento que materializou o direito, BI, explicação e parecer. Assinam o OD e o Auxiliar Div Pg Pes. Abre o pacote completo.
- **Contracheque e fichas sem guardar os arquivos** ✅ *(fase D, 19/10/2026)*: leitor do Comprovante Mensal de Rendimentos do CPEx (nome, Prec-CP, OM de vinculação, P/G de pagamento, CPF, banco, agência, conta e linhas do mês, com conferência dos totais; ignora a marca d'água). O tipo do PDF é reconhecido pelo título. Os PDFs são lidos na memória e descartados; só os dados vão para o banco. O contracheque substitui só o mês dele nos recebidos; a ficha, o ano inteiro. Envio de um ou vários documentos em Dados do favorecido, Contracheque - F Financeira e Novo processo. PDFs de fichas guardados antes desta fase continuam no Storage até decisão de apagar.

**Pendentes**

0. **Z99 – Pensão judiciária**: qual(is) código(s) do SIPPES entram? Candidatos: ND0014 (pensão alimentícia, mensal), ND0036 (sobre férias), ND0037 (sobre compensação pecuniária), ND0096/ND0097 (sobre o 13º). Até decidir, a OM escolhe na revisão do envio.
Nenhuma. Próximo passo: fase 0 (casos de teste) e fase 1 (motor de cálculo).
