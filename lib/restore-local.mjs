// Only restore into an empty, separately migrated SQLite database.
// Disable business triggers during snapshot import to avoid replaying effects.
export function restoreSnapshot(sqlite,snapshot){
 if(snapshot.format!=='pet-day-care-v1'||!snapshot.tables)throw Error('Formato de backup incompatível.');
 const allowed=new Set(sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '__*'").all().map(t=>t.name));
 const triggers=sqlite.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
 for(const table of allowed)if(sqlite.prepare(`SELECT COUNT(*) n FROM "${table}"`).get().n)throw Error('A restauração exige um banco vazio e separado.');
 sqlite.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;');
 try{
  for(const trigger of triggers)sqlite.exec(`DROP TRIGGER "${trigger.name}"`);
  for(const [table,records]of Object.entries(snapshot.tables)){
   if(!allowed.has(table)||!Array.isArray(records))throw Error('Tabela de backup inválida.');if(!records.length)continue;
   const allowedColumns=new Set(sqlite.prepare(`PRAGMA table_info("${table}")`).all().map(c=>c.name));
   const columns=Object.keys(records[0]);if(columns.some(c=>!allowedColumns.has(c)))throw Error('Coluna de backup inválida.');
   const statement=sqlite.prepare(`INSERT INTO "${table}" (${columns.map(c=>'"'+c+'"').join(',')}) VALUES (${columns.map(()=>'?').join(',')})`);
   for(const record of records)statement.run(...columns.map(c=>record[c]));
  }
  if(sqlite.prepare('PRAGMA foreign_key_check').all().length)throw Error('Backup possui relacionamentos inválidos.');
  if(sqlite.prepare('SELECT id FROM packages WHERE balance!=credits-COALESCE((SELECT SUM(units) FROM credit_events WHERE package_id=packages.id),0)').get())throw Error('Saldo de pacote inconsistente.');
  if(sqlite.prepare('SELECT id FROM products WHERE stock!=COALESCE((SELECT SUM(quantity) FROM stock_events WHERE product_id=products.id),0)').get())throw Error('Estoque inconsistente.');
  if(sqlite.prepare('SELECT id FROM lots WHERE stock!=COALESCE((SELECT SUM(quantity) FROM stock_events WHERE lot_id=lots.id),0)').get())throw Error('Lote inconsistente.');
  if(sqlite.prepare('SELECT id FROM invoices WHERE COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=invoices.id),0) NOT BETWEEN 0 AND amount_cents').get())throw Error('Saldo financeiro inconsistente.');
  for(const trigger of triggers)sqlite.exec(trigger.sql);
  sqlite.exec('COMMIT;');
 }catch(error){sqlite.exec('ROLLBACK;');throw error;}finally{sqlite.exec('PRAGMA foreign_keys=ON;');}
}
