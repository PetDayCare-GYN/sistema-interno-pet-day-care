-- Semeia o serviço de Banho e tosa (grooming) e seus adicionais (extras).
--
-- Modelo: na tabela `services`, o serviço base é kind='grooming' e cada adicional
-- é uma linha kind='extra' com preço e duração próprios. Ao agendar um Banho e tosa,
-- a equipe seleciona quais extras entram, e cada um soma preço/duração ao atendimento.
--
-- PREÇOS: todos entram como 0 ("a definir"). Ajuste o valor real de cada serviço e
-- adicional na tela de Serviços do sistema antes de cobrar. As durações são estimadas
-- e também podem ser editadas lá. Tudo aqui é editável manualmente depois.
--
-- active=1: já entram ativos para aparecer na agenda. capacity=1 por padrão.
--
-- Idempotente: INSERT OR IGNORE não duplica se já existir o mesmo id. Rodar de novo
-- não recria. (Renomear/ajustar preços na tela não é sobrescrito por nova execução.)
--
-- Como aplicar (Cloudflare D1):
--   wrangler d1 execute <NOME_DO_BANCO> --remote --file db/seed-services.sql
-- Em outro ambiente, execute este arquivo no banco de dados da aplicação.

-- Serviço base (grooming)
INSERT OR IGNORE INTO `services` (`id`,`name`,`kind`,`price_cents`,`duration_minutes`,`capacity`,`active`) VALUES
('seed-svc-banho-tosa','Banho e tosa','grooming',0,90,1,1);

-- Adicionais (kind='extra'): cada um soma preço e duração ao atendimento.
INSERT OR IGNORE INTO `services` (`id`,`name`,`kind`,`price_cents`,`duration_minutes`,`capacity`,`active`) VALUES
('seed-extra-banho-comum','Banho comum','extra',0,30,1,1),
('seed-extra-tosa-higienica','Tosa higiênica','extra',0,20,1,1),
('seed-extra-tosa-maquina','Tosa na máquina','extra',0,40,1,1),
('seed-extra-tosa-tesoura','Tosa na tesoura','extra',0,60,1,1),
('seed-extra-desembaraco','Desembaraçamento de pelos','extra',0,30,1,1),
('seed-extra-hidratacao','Hidratação da pelagem','extra',0,20,1,1),
('seed-extra-corte-unhas','Corte de unhas','extra',0,10,1,1),
('seed-extra-limpeza-ouvidos','Limpeza de ouvidos','extra',0,10,1,1),
('seed-extra-escovacao-dentes','Escovação de dentes','extra',0,10,1,1);
