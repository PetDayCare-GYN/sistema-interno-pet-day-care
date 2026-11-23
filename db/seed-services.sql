-- Catálogo de SERVIÇOS de fábrica: Creche, Hospedagem, Banho e tosa (por porte) e
-- Adicionais. A equipe só ajusta valores e duração na tela de Serviços.
--
-- Modelo:
--   * daycare  = Creche        * boarding = Hospedagem
--   * grooming = Banho e tosa  * extra    = Adicional (soma preço/duração ao atendimento)
-- Ao agendar um Banho e tosa, a equipe seleciona quais adicionais (extra) entram.
--
-- PREÇOS: todos entram como 0 ("a definir"). Ajuste o valor real de cada serviço e
-- adicional na tela de Serviços ANTES de cobrar. As durações e capacidades são
-- estimativas e também são editáveis. Tudo aqui é editável manualmente depois.
--
-- PORTES: o sistema usa Pequeno / Médio / Grande (não há "GG"). Os serviços de banho
-- e tosa entram separados por porte, conforme combinado.
--
-- active=1: já entram ativos para aparecer na agenda. capacity ajuste depois.
--
-- Idempotente: INSERT OR IGNORE não duplica se já existir o mesmo id. Os blocos de
-- Creche/Hospedagem base usam WHERE NOT EXISTS para NÃO duplicar os serviços que a
-- loja já tenha cadastrado manualmente. Rodar de novo não recria nem sobrescreve o
-- que você ajustou na tela.
--
-- Como aplicar (Cloudflare D1):
--   wrangler d1 execute <NOME_DO_BANCO> --remote --file db/seed-services.sql

-- ============================================================
-- CRECHE (daycare)
-- ============================================================
-- Diária integral: só cria se a loja ainda não tiver NENHUM serviço de creche ativo
-- (evita duplicar a creche já cadastrada manualmente).
INSERT OR IGNORE INTO `services` (`id`,`name`,`kind`,`price_cents`,`duration_minutes`,`capacity`,`active`)
SELECT 'seed-svc-creche-integral','Diária creche (integral)','daycare',0,600,30,1
WHERE NOT EXISTS (SELECT 1 FROM `services` WHERE `kind`='daycare' AND `active`=1);

-- Novos serviços de creche (sempre adicionados):
INSERT OR IGNORE INTO `services` (`id`,`name`,`kind`,`price_cents`,`duration_minutes`,`capacity`,`active`) VALUES
('seed-svc-creche-meia','Meia diária creche (até 4h)','daycare',0,240,30,1),
('seed-svc-creche-avaliacao','Avaliação / adaptação','daycare',0,600,5,1);

-- ============================================================
-- HOSPEDAGEM (boarding)
-- ============================================================
-- Diária de hospedagem: só cria se a loja ainda não tiver hospedagem ativa.
-- Acréscimo de alta temporada é configurado na tela "Temporadas e preços" (por porte),
-- não como um serviço separado.
INSERT OR IGNORE INTO `services` (`id`,`name`,`kind`,`price_cents`,`duration_minutes`,`capacity`,`active`)
SELECT 'seed-svc-hospedagem','Diária hospedagem','boarding',0,1440,20,1
WHERE NOT EXISTS (SELECT 1 FROM `services` WHERE `kind`='boarding' AND `active`=1);

-- ============================================================
-- BANHO E TOSA (grooming) — separados por porte (Pequeno / Médio / Grande)
-- ============================================================
INSERT OR IGNORE INTO `services` (`id`,`name`,`kind`,`price_cents`,`duration_minutes`,`capacity`,`active`) VALUES
-- Banho
('seed-svc-banho-p','Banho — Pequeno','grooming',0,30,1,1),
('seed-svc-banho-m','Banho — Médio','grooming',0,40,1,1),
('seed-svc-banho-g','Banho — Grande','grooming',0,50,1,1),
-- Banho + tosa higiênica (combo mais vendido)
('seed-svc-banho-higienica-p','Banho + tosa higiênica — Pequeno','grooming',0,50,1,1),
('seed-svc-banho-higienica-m','Banho + tosa higiênica — Médio','grooming',0,60,1,1),
('seed-svc-banho-higienica-g','Banho + tosa higiênica — Grande','grooming',0,75,1,1),
-- Tosa na máquina
('seed-svc-tosa-maquina-p','Tosa na máquina — Pequeno','grooming',0,60,1,1),
('seed-svc-tosa-maquina-m','Tosa na máquina — Médio','grooming',0,75,1,1),
('seed-svc-tosa-maquina-g','Tosa na máquina — Grande','grooming',0,90,1,1),
-- Tosa na tesoura
('seed-svc-tosa-tesoura-p','Tosa na tesoura — Pequeno','grooming',0,75,1,1),
('seed-svc-tosa-tesoura-m','Tosa na tesoura — Médio','grooming',0,90,1,1),
('seed-svc-tosa-tesoura-g','Tosa na tesoura — Grande','grooming',0,120,1,1),
-- Tosa da raça
('seed-svc-tosa-raca-p','Tosa da raça — Pequeno','grooming',0,75,1,1),
('seed-svc-tosa-raca-m','Tosa da raça — Médio','grooming',0,90,1,1),
('seed-svc-tosa-raca-g','Tosa da raça — Grande','grooming',0,120,1,1);

-- Serviço base genérico de Banho e tosa (compatibilidade com o pacote "Banho 4x" já
-- semeado). Se preferir trabalhar só com os serviços por porte acima, desative este
-- na tela de Serviços.
INSERT OR IGNORE INTO `services` (`id`,`name`,`kind`,`price_cents`,`duration_minutes`,`capacity`,`active`) VALUES
('seed-svc-banho-tosa','Banho e tosa','grooming',0,90,1,1);

-- ============================================================
-- ADICIONAIS (extra): cada um soma preço e duração ao atendimento.
-- ============================================================
INSERT OR IGNORE INTO `services` (`id`,`name`,`kind`,`price_cents`,`duration_minutes`,`capacity`,`active`) VALUES
('seed-extra-banho-comum','Banho comum','extra',0,30,1,1),
('seed-extra-tosa-higienica','Tosa higiênica','extra',0,20,1,1),
('seed-extra-tosa-maquina','Tosa na máquina','extra',0,40,1,1),
('seed-extra-tosa-tesoura','Tosa na tesoura','extra',0,60,1,1),
('seed-extra-desembaraco','Desembaraçamento de pelos','extra',0,30,1,1),
('seed-extra-hidratacao','Hidratação da pelagem','extra',0,20,1,1),
('seed-extra-corte-unhas','Corte de unhas','extra',0,10,1,1),
('seed-extra-limpeza-ouvidos','Limpeza de ouvidos','extra',0,10,1,1),
('seed-extra-escovacao-dentes','Escovação de dentes','extra',0,10,1,1),
-- Novos adicionais (hospedagem / creche / transporte):
('seed-extra-medicamento','Administração de medicamento','extra',0,10,1,1),
('seed-extra-passeio','Passeio individual','extra',0,30,1,1),
('seed-extra-transporte','Transporte leva e traz','extra',0,30,1,1);
