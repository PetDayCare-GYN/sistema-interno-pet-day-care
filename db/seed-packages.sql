-- Semeia os MODELOS DE PACOTES (package_templates): Banho e Creche.
--
-- Modelo: cada pacote é um crédito pré-pago ligado a um serviço. Ao contratar,
-- o pet ganha um `package` com saldo = créditos e validade = valid_days. Cada
-- atendimento daquele serviço consome 1 crédito. Para creche, use a tela
-- "Recorrência de creche" para gerar os atendimentos nos dias da semana
-- marcados (seg/qua, ter/qui, etc.) consumindo os créditos do pacote.
--
-- Pacotes semeados (créditos por mês, validade 30 dias):
--   Banho .............. 4 banhos/mês ....... 4 créditos
--   Creche 2x/semana ... ~2 dias × 4 sem .... 8 créditos
--   Creche 3x/semana ... ~3 dias × 4 sem .... 12 créditos
--   Creche todos os dias ~dias úteis do mês . 22 créditos
--
-- PREÇOS: entram como 0 ("a definir"). Ajuste o valor real de cada pacote na
-- tela Configurações → "Modelos de pacotes" ANTES de contratar/cobrar, senão a
-- conta a receber da contratação sai como R$ 0.
--
-- SERVIÇO DE CRECHE: os pacotes de creche apontam para o serviço de creche
-- (kind='daycare') ATIVO mais antigo. Portanto, CRIE o serviço de creche em
-- Serviços (e deixe ativo) ANTES de rodar este seed — caso contrário as linhas
-- de creche simplesmente não são inseridas (o INSERT ... SELECT não acha o
-- serviço). O Banho aponta para 'seed-svc-banho-tosa' (ver db/seed-services.sql).
--
-- Idempotente: INSERT OR IGNORE não duplica se o id já existir. Rodar de novo
-- não recria nem sobrescreve o que você ajustou na tela.
--
-- Como aplicar (Cloudflare D1):
--   wrangler d1 execute <NOME_DO_BANCO> --remote --file db/seed-packages.sql
-- Rode db/seed-services.sql antes (serviço de banho) e crie o serviço de creche.

-- Pacote de Banho: 4 banhos no mês (serviço base de banho e tosa).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-banho-4','Pacote Banho (4 no mês)',`s`.`id`,4,0,30,1
FROM `services` `s` WHERE `s`.`id`='seed-svc-banho-tosa';

-- Pacote de Creche 2x por semana (~8 créditos no mês).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-creche-2x','Pacote Creche 2x/semana',`s`.`id`,8,0,30,1
FROM `services` `s` WHERE `s`.`kind`='daycare' AND `s`.`active`=1
ORDER BY `s`.`created_at` LIMIT 1;

-- Pacote de Creche 3x por semana (~12 créditos no mês).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-creche-3x','Pacote Creche 3x/semana',`s`.`id`,12,0,30,1
FROM `services` `s` WHERE `s`.`kind`='daycare' AND `s`.`active`=1
ORDER BY `s`.`created_at` LIMIT 1;

-- Pacote de Creche todos os dias (~22 créditos no mês / dias úteis).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-creche-diaria','Pacote Creche todos os dias',`s`.`id`,22,0,30,1
FROM `services` `s` WHERE `s`.`kind`='daycare' AND `s`.`active`=1
ORDER BY `s`.`created_at` LIMIT 1;
