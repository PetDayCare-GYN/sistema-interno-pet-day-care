# Pet Day Care — gestão integrada

Aplicação funcional com React/Vinext, servidor Cloudflare Workers, 32 tabelas relacionais D1 e arquivos privados R2. Publicação privada pelo Sites. Não contém cadastros demonstrativos em produção.

## Primeiro acesso

Entre pela conta ChatGPT autorizada e configure a empresa, a responsável e uma senha adicional para infraestrutura. Depois configure capacidades, serviços/preços, pacotes, temporadas, regras de hospedagem, requisitos sanitários e equipe. Para banho, crie o modelo inicial com quatro créditos. Cadastre nomes/e-mails reais das duas proprietárias, duas monitoras e banhista; autorize suas contas no acesso privado do Site.

Cadastro → agenda → entrada → diário → conclusão/saída → pacote, financeiro e comissão. Compra/venda → estoque, lotes e financeiro. Os efeitos são transacionais, auditados e não se repetem indevidamente. Recuperação do login é gerenciada pela conta ChatGPT. A senha técnica é armazenada como hash e nunca é enviada ao navegador.

## Desenvolvimento

Node 22.13+; instalação pelo script `install:ci`. Comandos:

```text
npm run dev
npm run build
node --test tests/integration.test.mjs tests/security.test.mjs
node scripts/runtime-smoke.mjs
```

O último comando usa exclusivamente a prévia local `127.0.0.1:5173` e cria dados QA no D1 local. Nunca executa gravações em produção. A prévia usa autenticação simulada do starter; essa simulação não integra a versão publicada.

Gere mudanças de esquema com `npm run db:generate` e atualize os metadados com `node scripts/schema-columns.mjs`. As migrações SQL são versionadas em `drizzle/`; as regras transacionais estão também documentadas em `db/business.sql`. Não altere uma migração aplicada: acrescente outra. Para desenvolvimento, aplique as pendentes com Wrangler D1 local antes de abrir a prévia. O Sites aplica as migrações publicadas ao banco hospedado.

No Windows desta sessão, o npm foi invocado por seu entrypoint JavaScript oficial e usou cache em `.sites-runtime/`. Git portátil oficial foi usado exclusivamente nessa pasta ignorada. Esses ajustes não fazem parte da aplicação publicada.

## Segredos e publicação

O `.env` original está no diretório pai e não é copiado, lido pelo cliente ou enviado ao repositório da plataforma. Arquivos `.env*`, estado local, dependências e dados QA são ignorados. `BACKUP_SERVICE_HASH` é um segredo de runtime gerenciado pelo Sites. Não salvar tokens em `hosting.json`, documentos, código, URLs ou logs.

Manifesto de hospedagem: `.openai/hosting.json`. Projeto: `appgprj_6ace87617b9c8191b9c4f0b34c4fed38`. Banco e bucket são provisionados pelo Sites. Os detalhes confirmados da publicação são registrados em `docs/PUBLICACAO.md` após a implantação.

## Backup e recuperação

O módulo técnico permite criar e baixar backups lógicos privados após senha adicional. A rotina diária usa o acesso de serviço do Sites, com autorização adicional por hash. Consulte `docs/AUTOMACAO.md` para a operação e a retenção.

Para validar um arquivo de backup em SQLite separado:

```text
node scripts/restore-backup.mjs backup.json banco-novo.sqlite
```

O destino precisa ser novo. A restauração desativa os efeitos de negócio durante a importação, restaura os gatilhos e verifica relacionamentos, pacotes, lotes, estoque e financeiro. Não sobrescreve produção. Arquivos R2 e recuperação de produção exigem procedimentos próprios. Backups contêm dados privados e devem permanecer protegidos.

## Documentação

- `docs/ARQUITETURA.md`: arquitetura, entidades, fluxos, permissões e testes.
- `docs/REQUISITOS.txt`: especificação original.
- `docs/ACEITE.md`: cenários validados e pendências explicitamente identificadas.
- `docs/AUTOMACAO.md`: operação de backup diário.

Esta é uma primeira versão funcional integrada. O documento de aceite distingue recursos implementados, configurações necessárias e partes ainda pendentes da especificação integral.
