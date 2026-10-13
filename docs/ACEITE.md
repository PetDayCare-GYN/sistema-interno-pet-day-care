# Verificação e limites desta entrega

Treze testes de integração foram aprovados com o mesmo esquema SQL e as mesmas funções de API usadas pela aplicação. Cobrem cadastro central, nomes repetidos, reflexo de alterações, duplicidade de telefone, pacote 4→3, adicionais, comissão proporcional, cancelamento e falta sem consumo, repetição de requisições, capacidade, conflitos, duração, duas políticas de temporada, compra/venda/lote e rollback, pagamentos parciais/estornos, saúde e admissão, autorização, senha adicional/tentativas/revogação, marca/contraste, relatórios e restauração validada.

Build e TypeScript aprovados. As migrações foram aplicadas também no D1 local, pelo runtime Cloudflare. Teste HTTP da página e sessão: HTTP 200. O teste de fluxo local confirma o consumo de pacote em D1. Dados de teste e sessões locais são ignorados e não são enviados à produção.

Não havia navegador habilitado nesta sessão. Portanto, QA visual e interação por toque em celular, tablet e desktop não estão verificados. CSS contém adaptações para esses tamanhos, mas isso não equivale a teste visual concluído.

## Configuração necessária ao primeiro acesso

Nome da empresa, nome da proprietária e senha técnica; capacidades; serviços e preços; modelos de pacotes e validade; políticas de duração, temporadas, períodos parciais e hora adicional da hospedagem; nomes/e-mails reais da equipe, acesso privado das contas; comissões individuais; requisitos sanitários; identidade visual.

## Limites e trabalho remanescente

- Uma empresa por publicação. Não há isolamento multiempresa implementado nem anunciado.
- WhatsApp/e-mail automáticos dependem de provedores oficiais e permanecem sem envio. Contatos manuais e lembretes internos são reais.
- Backups lógicos privados, retenção e restauração em banco separado foram implementados. A cópia independente de fotos/documentos R2 e a recuperação de produção precisam de configuração da infraestrutura. A rotina diária só pode ser considerada ativa após confirmação do agendamento no Sites.
- Listas operacionais limitadas aos 5.000 registros mais recentes; auditoria aos 500 eventos mais recentes na interface. Registros antigos permanecem no banco. Paginação completa deve ser acrescentada para maior volume.
- Exportação implementada em CSV. PDF, listas analíticas avançadas, gráficos de giro/recorrência/lucro e fechamento formal de caixa ainda não foram implementados.
- Comissões são configuradas por pessoa, percentual/fixa e serviços/produtos elegíveis, com base cobrada ou proporcional de pacote. Bônus, escalas e condições avançadas de apuração/pagamento ainda precisam de expansão.
- Ajustes, perdas, inventários e devoluções de estoque preservam motivos e auditoria; reembolso é feito no financeiro. Devolução completa por um assistente único de estorno de pedido ainda não existe.
- Banho/tosa compartilham ficha de atendimento e adicionais configuráveis. Registro estruturado separado de condição de pelagem, todos os serviços efetivamente realizados e fotos antes/depois precisa de refinamento; observações e arquivos já são persistidos.
- Lista de espera está implementada. Sua promoção exige criar uma nova reserva após conferir a disponibilidade; reagendamento exige cancelar a anterior e criar a nova. Calendário gráfico mensal e horários de trabalho/feriados ainda precisam de expansão.
- Arquivamento preserva histórico. Uma política específica de retenção/anonimização de dados pessoais deve ser definida pelo estabelecimento antes da operação definitiva.

A plataforma publicada é uma primeira versão funcional integrada. Esta documentação não declara os 27 itens da especificação integralmente concluídos.
