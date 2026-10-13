# Plataforma integrada Pet Day Care

## Arquitetura proposta, antes da implementação

Aplicação responsiva React/Vinext em Cloudflare Workers, publicada privadamente pelo Sites. Banco relacional D1 (SQLite) e arquivos privados R2. Uma empresa por publicação, sem alegar isolamento multiempresa. Tutores e pets têm identificadores UUID e são as únicas fontes de cadastro. APIs validam identidade, permissões e dados no servidor; não há dados demonstrativos na produção.

As migrações da hospedagem criam tabelas e índices. O transporte de migrações do Sites não aceita corpos de gatilhos com múltiplos ponto-e-vírgulas; os gatilhos são instalados, um por declaração preparada, na primeira configuração autorizada, na mesma transação que cria a empresa. Uma falha impede a configuração inteira. As tabelas não são criadas nem alteradas durante requisições. Na restauração, os gatilhos são reinstalados após importar o snapshot para não repetir movimentos.

## Modelo e relacionamentos

Empresa → configurações globais, serviços, temporadas, usuários e marca.
Tutor → vários pets; pet → responsáveis autorizados, arquivos, saúde, pacotes, agendamentos e atividades.
Serviço → agendamentos e modelos de pacote. Modelo → contratação → lançamentos imutáveis de consumo. Agendamento → adicionais, check-in/check-out, histórico, fatura e comissão.
Produto → categoria, marca, fornecedor, lotes e movimentos de estoque. Compra/venda → itens → movimentos e fatura. Fatura → pagamentos e estornos. Usuário → permissões, regras de comissão, auditoria e registros operacionais.
Notificações e relatórios consultam esses relacionamentos, sem cadastros paralelos.

## Fluxos de negócio

1. Cadastrar tutor e pets, com foto opcional e identificadores distintos mesmo para nomes iguais.
2. Selecionar pet na agenda, consultar saúde/pacotes, escolher serviço, responsável e adicionais. Validar intervalos, capacidade e disponibilidade na gravação.
3. Check-in registra pessoa autorizada, pertences e instruções. Atividades registram responsável e horário.
4. Conclusão/check-out calcula duração e valores conforme regras configuradas. Uma transação gera consumo único, cobrança de adicionais/avulso e comissão. Cancelamento/falta não consome pacote. Repetir conclusão não duplica efeitos.
5. Compra de pacote gera fatura uma vez. O uso não gera receita duplicada.
6. Compra/venda de produtos posta itens, estoque e financeiro em transação; o banco impede estoque negativo. Pagamentos e estornos são registros separados, sem apagar história.
7. Saúde, vencimentos, capacidade e pendências alimentam alertas e indicadores reais.

## Implementação

Fundação: esquema, autenticação, permissões, cadastros, arquivos e auditoria.
Operação: serviços configuráveis, agenda, pacotes, creche, hospedagem, banho, check-in/out e diário.
Controle: saúde, estoque, compras/vendas, equipe, comissões e financeiro.
Gestão: painel, alertas internos, relatórios e CSV autorizado.
Robustez: marca global, infraestrutura com senha adicional, backups, testes e documentação de limites.

## Autenticação e permissões

Login e recuperação de acesso pela conta ChatGPT, com autenticação gerenciada pelo Sites. A primeira configuração é feita na publicação privada pela proprietária. Outras pessoas precisam ser autorizadas no acesso do Site e cadastradas na equipe por e-mail. Perfis: gestão, operação e técnico; permissões explícitas por usuário. Nenhuma permissão é confiada ao navegador. Infraestrutura exige senha independente com PBKDF2, limite de tentativas e autorização temporária vinculada à identidade. Segredos nunca chegam ao navegador ou repositório.

## Backup e recuperação

D1 fornece recuperação Time Travel gerenciada; janela e acesso dependem do serviço contratado e precisam ser conferidos no painel. Exportações lógicas privadas e versionadas podem ser armazenadas em R2, com retenção configurável. Um backup de registros não substitui cópia dos arquivos anexos. Restauração exige administrador técnico, senha adicional e ambiente de manutenção. Primeiro validar a restauração em banco separado, conferir integridade referencial, saldos de pacotes, estoque, faturas e pagamentos; só depois promover. Nunca sobrescrever produção sem backup anterior. Agendamento automático depende de habilitação do agendador de hospedagem.

## Estratégia de testes

Integração real em SQLite com o mesmo SQL e API: nomes repetidos; alterações no cadastro; compra/consumo/cancelamento de pacotes; conclusão repetida; concorrência/capacidade; temporadas; saúde; compra/venda/estoque; pagamentos parciais/estornos; comissão; autorização; segunda senha; marca persistida; relatórios; falha de gravação e rollback; backup/restauração. Build e tipos são verificados; QA visual em desktop e celular quando a prévia estiver disponível. A documentação de aceite distingue cenários aprovados de pendências.

## Decisões comerciais

Não há preço, tolerância, validade, taxa adicional, temporada ou comissão presumidos. Serviços/pacotes exigem configuração; hospedagem sem política de cobrança definida é bloqueada. Comunicação externa permanece desativada até a confirmação de um provedor. Cinco posições iniciais são orientadas na configuração da equipe: duas proprietárias, duas monitoras e uma banhista; nomes e e-mails reais são cadastrados pela gestão.

Referências técnicas: https://developers.cloudflare.com/d1/worker-api/d1-database/ e https://developers.cloudflare.com/d1/reference/time-travel/.
