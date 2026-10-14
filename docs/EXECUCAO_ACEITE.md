# Execução das pendências de aceite

Solicitada em 14/10/2026. Referência: `REQUISITOS.txt` e `ACEITE.md`.
Baseline: versão publicada 3, commit `c8e5fe5b532f0c9fcc839e59d80373b6e070b059`; 18 testes reexecutados e aprovados em 14/10/2026.

## Trabalho em andamento

- [x] Paginação de cadastros, operações e auditoria.
- [x] Histórico mestre de tutores e histórico financeiro do pet.
- [x] Reagendamento atômico, promoção da espera, calendário e disponibilidade por serviço/profissional.
- [x] Horários e feriados configuráveis.
- [x] Ficha de banho: condição da pelagem, serviços realizados e fotos vinculadas ao atendimento.
- [x] Observações de entrada/saída e fotos vinculadas ao diário.
- [x] Inventário físico e devolução/estorno completo de pedidos.
- [x] Categorias financeiras, fluxo de caixa, fechamento e resultados estimados.
- [x] Remuneração, bônus, escalas e critérios de comissão por período/recebimento.
- [x] Alertas com antecedência, prioridade, responsável e situação.
- [x] Indicadores do painel e relatórios gerenciais com filtros completos.
- [x] Exportações CSV/PDF com identidade visual.
- [x] Inventário técnico completo e identidade visual nas telas de acesso.
- [x] Backup com cópias dos anexos, exportação portátil e recuperação protegida.
- [x] Política administrativa de retenção, exportação e anonimização.
- [x] Testes de integração dos novos fluxos e build.
- [x] Verificação visual e toque emulado em computador, tablet e celular; aparelhos físicos não disponíveis.
- [x] Publicação da versão 4 e confirmação do backup completo na hospedagem em 14/10/2026.

## Configurações reais

Nomes/e-mails da equipe, serviços/preços/capacidades, regras comerciais, marca e política de retenção serão preenchidos pela empresa nos formulários administrativos. Nenhum dado de demonstração será criado em produção.

Uma empresa por publicação permanece o escopo atual: a especificação condiciona multiempresa à necessidade desse uso. Canais externos dependem de contas e credenciais oficiais; o registro manual continuará identificado como manual.

Um recurso só será marcado como concluído após implementação e verificação correspondente. Ausência de navegador ou credenciais externas será documentada como limite de validação/configuração, sem simular resultados.

## Resultado verificado — versão 4 (histórico)

42 testes de integração aprovados; TypeScript aprovado; build aprovado; 13 telas em três tamanhos e formulários verificados; recuperação com fotos em D1/R2 local; PDF renderizado e inspecionado. Consulte ACEITE.md para configurações reais e limites remanescentes.

Publicação confirmada: https://pet-day-care-gestao.spunkychick64.chatgpt.site. Deploy appgdep_6acfb5be71b88191beeea1d7e6cf2af2; commit ba0d2ef71a5cfcb170cd9ab21f47afa0da62fe86. As 45 tabelas e 32 regras foram confirmadas; backup completo 1d71981d-bb52-4146-a9b8-42852c490fb5, 17:04:57 UTC, sem anexos cadastrados na hospedagem naquele momento. Backup anterior à atualização: cad41102-6316-4880-934f-df7d3a12e6d8. Nenhuma restauração foi executada em produção.

## Ajuste solicitado de identificação visual

- [x] Campo de fotografia com prévia no cadastro/edição; PNG e JPEG/JPG, até 5 MB.
- [x] Cadastro e foto gravados juntos; substituição sem perda de campos ou histórico.
- [x] Remoção mediante confirmação e identificação de cadastros pendentes.
- [x] Seleção visual por foto, tutor, raça, porte e ID completo; pesquisa no banco.
- [x] Fotografia reutilizada nas agendas, fichas, saúde, pacotes, atividades e relatórios/PDF.
- [x] Validação operacional no servidor e proteção de vínculo da foto pelo banco.
- [x] Nove critérios verificados; 52 testes de integração e QA em três tamanhos.

O resultado nativo da publicação desta atualização é registrado em outputs/PUBLICACAO.md após o deploy. Nenhuma imagem ou cadastro QA é publicado como dado real.
