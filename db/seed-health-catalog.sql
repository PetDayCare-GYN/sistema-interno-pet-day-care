-- Semeia o catálogo inicial de Saúde preventiva (tabela health_catalog).
--
-- Idempotente: usamos INSERT OR IGNORE com id fixo por item, então rodar
-- novamente não duplica os itens já existentes. Intervalos são os usuais para
-- cães/gatos adultos; o veterinário responsável pode ajustar no cadastro.
--
-- Como aplicar (Cloudflare D1), após aplicar a migração 0017_health_catalog.sql:
--   wrangler d1 execute pet-day-care --remote --file db/seed-health-catalog.sql
-- Em outro ambiente, execute este arquivo no banco de dados da aplicação.
--
-- Colunas: id,name,kind,species,interval_days,puppy_doses,puppy_interval_days,required,recommended,active

INSERT OR IGNORE INTO `health_catalog`
 (`id`,`name`,`kind`,`species`,`interval_days`,`puppy_doses`,`puppy_interval_days`,`required`,`recommended`,`active`) VALUES
('seed-health-v8v10','V8 / V10 (polivalente)','vacina','Cão',365,3,25,1,0,1),
('seed-health-antirrabica','Antirrábica','vacina','Cão',365,NULL,NULL,1,0,1),
('seed-health-gripe','Gripe canina (tosse dos canis)','vacina','Cão',365,2,25,1,0,1),
('seed-health-giardia','Giárdia','vacina','Cão',365,2,25,0,1,1),
('seed-health-leishmaniose','Leishmaniose','vacina','Cão',365,3,21,0,1,1),
('seed-health-vermifugo','Vermífugo','vermífugo','Cão',90,NULL,NULL,1,0,1),
('seed-health-antipulgas-mensal','Antipulgas/carrapatos – comprimido mensal','antiparasitário','Cão',30,NULL,NULL,1,0,1),
('seed-health-antipulgas-trimestral','Antipulgas/carrapatos – comprimido trimestral','antiparasitário','Cão',90,NULL,NULL,1,0,1),
('seed-health-pipeta','Pipeta (spot-on)','antiparasitário','Ambos',30,NULL,NULL,1,0,1),
('seed-health-coleira','Coleira repelente','antiparasitário','Cão',180,NULL,NULL,1,0,1);
