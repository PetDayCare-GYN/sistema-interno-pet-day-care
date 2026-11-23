-- Catálogo de MODELOS DE PACOTES (package_templates) de fábrica: Banho, Creche e
-- Hospedagem. A equipe só ajusta o preço na tela Configurações → "Modelos de pacotes".
--
-- Modelo: cada pacote é um crédito pré-pago ligado a UM serviço. Ao contratar, o pet
-- ganha um `package` com saldo = créditos e validade = valid_days. Cada atendimento
-- daquele serviço consome 1 crédito. Para creche, use a tela "Recorrência de creche"
-- para gerar os atendimentos nos dias marcados (seg/qua, ter/qui, etc.) consumindo os
-- créditos do pacote.
--
-- PREÇOS: entram como 0 ("a definir"). Ajuste o valor real de cada pacote na tela de
-- Modelos de pacotes ANTES de contratar/cobrar, senão a conta a receber sai como R$ 0.
--
-- SERVIÇOS DE CRECHE/HOSPEDAGEM: os pacotes apontam para o serviço de creche
-- (kind='daycare') / hospedagem (kind='boarding') ATIVO mais antigo. Rode
-- db/seed-services.sql ANTES (ele cria creche e hospedagem base se ainda não existirem).
-- O Banho aponta para 'seed-svc-banho-tosa' (ver db/seed-services.sql).
--
-- Idempotente: INSERT OR IGNORE não duplica se o id já existir. Os pacotes com
-- INSERT ... SELECT só inserem se o serviço-alvo existir; se não houver creche/
-- hospedagem ativa, a linha simplesmente não é criada (rode o seed de serviços antes).
--
-- Como aplicar (Cloudflare D1):
--   wrangler d1 execute <NOME_DO_BANCO> --remote --file db/seed-packages.sql

-- ============================================================
-- BANHO
-- ============================================================
-- Banho 2x (2 banhos, validade 30 dias).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-banho-2','Pacote Banho 2x',`s`.`id`,2,0,30,1
FROM `services` `s` WHERE `s`.`id`='seed-svc-banho-tosa';

-- Banho 4x (4 banhos, validade 60 dias).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-banho-4','Pacote Banho 4x',`s`.`id`,4,0,60,1
FROM `services` `s` WHERE `s`.`id`='seed-svc-banho-tosa';

-- ============================================================
-- CRECHE
-- ============================================================
-- Creche 2x por semana (~8 créditos no mês, validade 30 dias).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-creche-2x','Pacote Creche 2x/semana',`s`.`id`,8,0,30,1
FROM `services` `s` WHERE `s`.`kind`='daycare' AND `s`.`active`=1
ORDER BY `s`.`created_at` LIMIT 1;

-- Creche 3x por semana (~12 créditos no mês, validade 30 dias).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-creche-3x','Pacote Creche 3x/semana',`s`.`id`,12,0,30,1
FROM `services` `s` WHERE `s`.`kind`='daycare' AND `s`.`active`=1
ORDER BY `s`.`created_at` LIMIT 1;

-- Creche mensal integral (20 créditos, validade 30 dias).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-creche-mensal','Pacote Creche mensal integral',`s`.`id`,20,0,30,1
FROM `services` `s` WHERE `s`.`kind`='daycare' AND `s`.`active`=1
ORDER BY `s`.`created_at` LIMIT 1;

-- Creche todos os dias (~22 créditos / dias úteis, validade 30 dias).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-creche-diaria','Pacote Creche todos os dias',`s`.`id`,22,0,30,1
FROM `services` `s` WHERE `s`.`kind`='daycare' AND `s`.`active`=1
ORDER BY `s`.`created_at` LIMIT 1;

-- ============================================================
-- HOSPEDAGEM
-- ============================================================
-- Hospedagem semana (7 diárias, validade 90 dias).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-hosp-semana','Pacote Hospedagem semana',`s`.`id`,7,0,90,1
FROM `services` `s` WHERE `s`.`kind`='boarding' AND `s`.`active`=1
ORDER BY `s`.`created_at` LIMIT 1;

-- Hospedagem quinzena (15 diárias, validade 120 dias).
INSERT OR IGNORE INTO `package_templates`
  (`id`,`name`,`service_id`,`credits`,`price_cents`,`valid_days`,`active`)
SELECT 'seed-pkg-hosp-quinzena','Pacote Hospedagem quinzena',`s`.`id`,15,0,120,1
FROM `services` `s` WHERE `s`.`kind`='boarding' AND `s`.`active`=1
ORDER BY `s`.`created_at` LIMIT 1;

-- ============================================================
-- COMBO (Creche + banho mensal) — ADIADO (Fase 2)
-- ============================================================
-- Um pacote que cobre MAIS DE UM serviço (ex.: 12 diárias de creche + 1 banho) ainda
-- não é suportado: cada package_templates aponta para um único serviço. Será entregue
-- na Fase 2 como "combo" que, ao contratar, gera pacotes separados (1 de creche + 1 de
-- banho) com uma única cobrança.
