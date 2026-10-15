-- Semeia a equipe inicial com acesso por nome de usuário e senha padrão.
--
-- Senha padrão de todas: PetDayCare@2026 (hash PBKDF2, mesmo algoritmo de lib/business.mjs).
-- Todas entram com must_change_password=1: na primeira entrada o sistema obriga a
-- definir uma nova senha pessoal antes de liberar qualquer tela.
--
-- Perfis: luisa, karla, miriam = management (acesso total, inclui técnico).
--         isabela, sarah, mariana = operation (agenda, creche, hospedagem, banho, cadastros).
--
-- Idempotente: INSERT OR IGNORE não duplica se já existir o mesmo id ou username.
-- Requer a migração 0014 aplicada (colunas username e must_change_password).
--
-- Como aplicar (Cloudflare D1):
--   wrangler d1 execute <NOME_DO_BANCO> --remote --file db/seed-team.sql
-- Em outro ambiente, execute este arquivo no banco de dados da aplicação.
--
-- IMPORTANTE: os e-mails abaixo são apenas identificadores internos (@petday.local).
-- O acesso é feito pelo nome de usuário. A gestão pode ajustar e-mail/usuário na tela de Equipe.

INSERT OR IGNORE INTO `users` (`id`,`email`,`username`,`name`,`role`,`permissions`,`active`,`must_change_password`,`password_hash`) VALUES
('seed-luisa','luisa@petday.local','luisa','Luisa','management','{"technical":{"read":true,"create":true,"edit":true,"cancel":true,"export":true,"approve":true}}',1,1,'pbkdf2:100000:petdaycare-seed-2026:643fcf9fce27c7f95e1a510599efa8daeac73cc197b918bc9968175b977a4e83'),
('seed-karla','karla@petday.local','karla','Karla','management','{"technical":{"read":true,"create":true,"edit":true,"cancel":true,"export":true,"approve":true}}',1,1,'pbkdf2:100000:petdaycare-seed-2026:643fcf9fce27c7f95e1a510599efa8daeac73cc197b918bc9968175b977a4e83'),
('seed-miriam','miriam@petday.local','miriam','Miriam','management','{"technical":{"read":true,"create":true,"edit":true,"cancel":true,"export":true,"approve":true}}',1,1,'pbkdf2:100000:petdaycare-seed-2026:643fcf9fce27c7f95e1a510599efa8daeac73cc197b918bc9968175b977a4e83'),
('seed-isabela','isabela@petday.local','isabela','Isabela','operation','{}',1,1,'pbkdf2:100000:petdaycare-seed-2026:643fcf9fce27c7f95e1a510599efa8daeac73cc197b918bc9968175b977a4e83'),
('seed-sarah','sarah@petday.local','sarah','Sarah','operation','{}',1,1,'pbkdf2:100000:petdaycare-seed-2026:643fcf9fce27c7f95e1a510599efa8daeac73cc197b918bc9968175b977a4e83'),
('seed-mariana','mariana@petday.local','mariana','Mariana','operation','{}',1,1,'pbkdf2:100000:petdaycare-seed-2026:643fcf9fce27c7f95e1a510599efa8daeac73cc197b918bc9968175b977a4e83');
