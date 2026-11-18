-- Semeia as marcas de ração/produtos iniciais no cadastro de Estoque (tabela brands).
--
-- Idempotente: a coluna name é UNIQUE e usamos INSERT OR IGNORE, então rodar
-- novamente não duplica marcas já existentes (nem por id, nem por nome).
--
-- Como aplicar (Cloudflare D1):
--   wrangler d1 execute <NOME_DO_BANCO> --remote --file db/seed-brands.sql
-- Em outro ambiente, execute este arquivo no banco de dados da aplicação.

INSERT OR IGNORE INTO `brands` (`id`,`name`) VALUES
('seed-brand-royal-canin','Royal Canin'),
('seed-brand-hills','Hill''s'),
('seed-brand-premier','PremieR'),
('seed-brand-farmina-nd','Farmina N&D'),
('seed-brand-biofresh','Biofresh'),
('seed-brand-formula-natural','Fórmula Natural'),
('seed-brand-guabi-natural','Guabi Natural'),
('seed-brand-vet-life','Vet Life'),
('seed-brand-golden','goldeN'),
('seed-brand-granplus','GranPlus'),
('seed-brand-quatree','Quatree'),
('seed-brand-special-dog','Special Dog'),
('seed-brand-bionatural','Bionatural'),
('seed-brand-pedigree','Pedigree'),
('seed-brand-magnus','Magnus');
