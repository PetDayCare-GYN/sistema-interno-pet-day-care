# Backup automático

Agendamento diário previsto para 03:00, America/Sao_Paulo. O agendador precisa estar ligado ao Site publicado. Em cada execução, obter o Site pelo identificador fornecido pelo Sites e seu token existente de acesso de serviço. Não gerar nem rotacionar tokens. Confirmar que o Site permanece privado e pertence à conta autorizada. Enviar POST à URL publicada + `/api/maintenance/backup` com `OAI-Sites-Authorization: Bearer <token existente>` e `X-Pet-Backup-Authorization: <mesmo token>`. Segredos são usados somente em memória e nunca aparecem em argumentos de shell, arquivos ou logs. Depois, consultar GET da mesma rota com os mesmos cabeçalhos e confirmar que `latest.id` corresponde ao ID retornado pela gravação.

O servidor compara o hash do token com o segredo de runtime `BACKUP_SERVICE_HASH`. Navegadores e pessoas da equipe não têm esse segredo. Uma rotação do token exige atualizar seu hash no runtime e reaplicar a versão publicada. Falhas devem ser reportadas; nunca informar backup realizado antes de confirmar gravação e leitura.

Retenção configurável de 7 a 365 dias, inicialmente 30. O backup é lógico, privado e limitado a 20 MB; bancos maiores exigem exportação D1 pela infraestrutura. Fotos e documentos possuem cópias protegidas no R2, com SHA-256/CRC32. O backup só informa status complete após conferir o banco, finalizar os anexos e executar o ensaio com rollback. Se needs_continuation for true, repetir POST até concluir e conferir latest.status=complete. ZIPs podem ser baixados em todas as partes para cópia fora da hospedagem. Destino automático externo ainda exige configuração. O agendamento não publica novas versões.

## Execução confirmada

O primeiro agendamento de 14/10/2026 foi confirmado por leitura: d8c7560d-8f1c-426c-91fe-5568d227108d, 05:59:55.828 UTC. O horário está próximo de 03:00 em America/Sao_Paulo; agendamento não implica execução no segundo exato. O agendador deve concluir eventuais continuações e reportar falhas. Após atualizar uma instalação configurada, a manutenção autenticada POST /api/maintenance/upgrade instala as regras da nova versão. Essa rota não recebe SQL arbitrário.
