# Verificação e limites da entrega

Atualizado em 14/10/2026. As pendências de implementação deste documento foram executadas. O sistema continua integrado ao cadastro mestre, com D1 e R2 privados. Nenhum cadastro de demonstração foi enviado à produção.

## Evidência de verificação

52 testes de integração aprovados com o mesmo esquema SQL e funções da API. Além dos 18 cenários anteriores, cobrem reagendamento e promoção da espera com rollback, capacidade por serviço, horários/feriados/escalas, serviços efetivamente realizados, inventário físico, devolução integral e reembolso pendente, remuneração/bônus, comissão condicionada ao recebimento e encerramento da apuração, fechamento/reabertura de caixa, paginação, documentos exigidos, recuperação com anexos, checksums, revisão concorrente, retenção e remoção de identificadores, restrições de manutenção, filtros e valores dos relatórios.

QA no Chromium com computador 1366×900, tablet 820×1180 e celular 390×844; 13 telas por tamanho. Toque emulado no tablet/celular, navegação, formulários, nomes repetidos diferenciados por identificação, ausência de transbordamento da página e ausência de erros JavaScript confirmados. Uma resposta perdida após gravação real mantém o formulário aberto e permite repetir sem duplicar o cadastro. Não houve teste em aparelhos físicos nem em Safari/Firefox.

O runtime Cloudflare local aplicou as migrações 0000–0009. No D1/R2 local, o fluxo de quatro banhos confirmou saldo 4→3; backup completo com fotos e recuperação protegida confirmaram relações, acesso atual e arquivos. A recuperação de produção não foi executada para teste. O PDF foi renderizado e inspecionado visualmente, com tabelas, identidade, filtros, identificação repetida nas partes e paginação. Artefatos de QA permanecem em outputs/qa, ignorados pelo Git.

## Pendências de código executadas

- Listas com paginação e busca no banco; auditoria paginada com detalhes sem segredos. A primeira carga traz até 100 registros por lista, e o usuário pode carregar os seguintes. Pagamentos acumulados e indicadores consultam todo o banco.
- Histórico mestre do tutor e financeiro vinculado ao pet; faturamento de outro pet do tutor não aparece como faturamento deste animal.
- Agenda por dia, semana e mês; filtros; reagendamento atômico; promoção da espera; extensão de hospedagem; capacidade por modalidade, serviço e profissional; horários, feriados e escalas configuráveis.
- Pelagem, observações de entrada/saída, serviços solicitados/realizados e fotos antes/depois vinculadas ao atendimento; fotos vinculadas ao diário.
- Marcas e descrição dos produtos; inventário físico; devolução integral de venda/compra com estoque, saldo e reembolso pendente. Reembolso exige pagamento registrado, sem simular devolução de dinheiro.
- Categorias financeiras, responsável beneficiário, fluxo realizado e fechamento/reabertura auditado do caixa. Resultado estimado distingue receita gerencial de recebimento e informa custo histórico desconhecido.
- Função, salário por apuração, bônus/meta, escalas e comissão individual fixa/percentual, por conclusão/recebimento e período. A regra é preservada em cada operação; pagamento pode aguardar o encerramento do período.
- Alertas por antecedência/tipo, prioridade, responsável, situação e adiamento; documentos pendentes e movimentos previstos de hospedagem. Contatos e retornos permanecem identificados como registros manuais.
- Indicadores reais, relatórios gerenciais com período/pet/tutor/serviço/profissional, gráficos de giro/recorrência/resultado e exportações CSV/PDF autorizadas.
- Identidade no acesso, menus, formulários e documentos; logo/favicon, cores de painéis, menus, texto e bordas, claro/escuro, contraste e restauração do padrão.
- Inventário técnico persistido de aplicação, fonte privada e URL, banco, arquivos, domínio/DNS gerenciados, autenticação e backup, com dependências e manutenção.
- Backup com cópias verificadas dos anexos, ZIP portátil, retenção e ensaio de recuperação com rollback. Recuperação exige senha adicional, conferência de arquivos, plano vigente, confirmação explícita e backup de segurança; preserva acessos e solicitações de remoção de identificadores.
- Política administrativa de retenção, exportação autorizada e remoção de identificadores pessoais. Reservas abertas, pets ativos, prazo não cumprido e saldos pendentes bloqueiam a remoção; arquivos e detalhes de auditoria vinculados são tratados sem apagar valores históricos.

## Configuração real necessária

Nome da empresa, proprietárias e equipe real; contas ChatGPT autorizadas; senha técnica; capacidades; serviços/preços; modelos de pacote e validade; temporadas, duração, tolerância, horas adicionais, taxas/créditos em cancelamento/falta; regras de comissão e remuneração; comprovantes e documentos; horário/feriados; marca e política de retenção. Os formulários administrativos permitem definir estas decisões. Não foram presumidos preços, funcionários ou regras comerciais em produção.

## Limites e trabalho dependente de infraestrutura

- Uma empresa por publicação. Multiempresa real fica condicionado à necessidade indicada na especificação; não há isolamento multiempresa anunciado.
- WhatsApp/e-mail automáticos aguardam provedores e credenciais oficiais. O sistema registra contatos, tarefas e alertas internos; não afirma ter enviado mensagens externas.
- A cópia dos anexos fica protegida no mesmo R2. Guardar todas as partes ZIP fora da hospedagem fornece cópia independente; envio automático para outro provedor depende de um destino real e suas credenciais.
- Recuperação protegida foi validada em SQLite separado e D1/R2 local. Perda integral de banco/acesso exige recuperação pela infraestrutura/conta proprietária, além do fluxo dentro da aplicação. Time Travel e sua janela dependem do serviço da hospedagem.
- Backup lógico até 20 MB; ZIP em partes de até 250 anexos; PDF até 2.000 linhas; relatórios até 366 dias. Volume superior exige exportação/recuperação pela infraestrutura ou filtros menores. Remoção administrativa de grande volume exige assistência quando ultrapassar a transação suportada.
- Custos antigos ausentes impedem afirmar lucro exato. O estabelecimento deve escolher reconhecimento gerencial de pacote na contratação ou consumo; saldos e recebimentos permanecem separados.
- O backup automático agendado às 03:00 America/Sao_Paulo executou em 14/10/2026 às 05:59:55 UTC: d8c7560d-8f1c-426c-91fe-5568d227108d. Essa execução anterior à expansão dos anexos foi lógica; a nova versão oferece backup completo e ensaio em cada conclusão.

Os 27 tópicos da especificação foram usados como referência de arquitetura, módulos, regras e processo. Esta verificação não equivale à homologação integral pela empresa nem à configuração das integrações externas.

## Identificação visual obrigatória dos pets — 14/10/2026

A fotografia PNG ou JPEG/JPG, até 5 MB e 40 megapixels, passou a integrar o cadastro e a identificação operacional. Novo cadastro exige foto; cadastro antigo sem imagem é sinalizado como pendente. Incluir/substituir a foto preserva os demais campos e os vínculos, e a remoção exige confirmação. Agendamento, promoção/reagendamento, confirmações de entrada/saída, pacotes e registros operacionais vinculados validam a foto no servidor. Cancelamentos e a consulta ao histórico continuam disponíveis para regularização.

Um componente compartilhado mostra foto, nome, tutor, raça, porte e ID completo na seleção. Agenda diária/semanal/mensal, fichas, histórico, saúde, pacotes, atividades e relatórios usam a referência atual do cadastro mestre. A imagem neutra é identificada como foto pendente, sem simular fotografia real. Atualizações são refletidas ao salvar, consultar novamente ou atualizar a janela; outra janela visível também revalida automaticamente a identificação em até 20 segundos. Os dados exibidos são projeções de leitura, sem cadastro ou foto separados por módulo.

CSV permanece textual, com a referência da foto; PDF e relatórios na tela incluem a imagem privada. PDF admite até 20 MB de fotografias distintas por exportação; PNG de até 6 megapixels por imagem no PDF, para limitar a descompressão em memória. O cadastro aceita até 40 megapixels e imagens maiores podem ser fornecidas em JPEG para exportação. Permanecem os limites já documentados.

52 testes de integração aprovados, incluindo os nove critérios do ajuste e a proteção de memória na exportação. QA adicional cobre os nove critérios solicitados com fotografias diferentes, nos três serviços, entradas/saídas, substituição, cadastros existentes, remoção confirmada, formato inválido e preservação dos IDs. Computador, tablet e celular foram verificados no Chromium com toque emulado; os PDFs foram renderizados e inspecionados. Artefatos locais: outputs/qa-pets. Na leitura autorizada da hospedagem antes desta atualização, havia zero pets cadastrados; nenhum dado de demonstração foi criado em produção. Requisito original: IDENTIFICACAO_VISUAL_PETS.txt.
