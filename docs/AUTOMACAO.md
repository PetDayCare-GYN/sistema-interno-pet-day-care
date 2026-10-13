# Backup automático

Agendamento diário previsto para 03:00, America/Sao_Paulo. O agendador precisa estar ligado ao Site publicado. Em cada execução, obter o Site pelo identificador fornecido pelo Sites e seu token existente de acesso de serviço. Não gerar nem rotacionar tokens. Confirmar que o Site permanece privado e pertence à conta autorizada. Enviar POST à URL publicada + `/api/maintenance/backup` com `OAI-Sites-Authorization: Bearer <token existente>` e `X-Pet-Backup-Authorization: <mesmo token>`. Segredos são usados somente em memória e nunca aparecem em argumentos de shell, arquivos ou logs. Depois, consultar GET da mesma rota com os mesmos cabeçalhos e confirmar que `latest.id` corresponde ao ID retornado pela gravação.

O servidor compara o hash do token com o segredo de runtime `BACKUP_SERVICE_HASH`. Navegadores e pessoas da equipe não têm esse segredo. Uma rotação do token exige atualizar seu hash no runtime e reaplicar a versão publicada. Falhas devem ser reportadas; nunca informar backup realizado antes de confirmar gravação e leitura.

Retenção configurável de 7 a 365 dias, inicialmente 30. O backup é lógico, privado e limitado a 20 MB; bancos maiores exigem exportação D1 pela infraestrutura. Fotos e documentos permanecem em R2 e exigem uma rotina de cópia separada. O agendamento não publica novas versões.
