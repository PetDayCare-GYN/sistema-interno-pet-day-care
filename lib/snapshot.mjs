import {tableColumns} from '../db/columns.mjs';
import {tableRelations} from '../db/relations.mjs';
import {columnDefaults} from '../db/defaults.mjs';
export const runtimeTables=new Set(['challenges','attempts','request_keys','backups','backup_files','maintenance_locks','privacy_jobs']);
export function validateSnapshot(snapshot,need=(value,message)=>{if(!value)throw Error(message);}) {
 need(snapshot?.format==='pet-day-care-v1'&&snapshot.tables&&typeof snapshot.tables==='object','Formato de backup incompatível.');
 const tables=snapshot.tables,indexes=new Map();
 for(const [name,records] of Object.entries(tables)) {
  need(Object.hasOwn(tableColumns,name)&&Array.isArray(records),'Tabela de backup inválida.');
  const ids=new Map();for(const record of records){need(record&&typeof record==='object'&&!Array.isArray(record)&&typeof record.id==='string'&&/^[A-Za-z0-9_:-]{1,100}$/.test(record.id),'Registro de backup inválido.');need(Object.keys(record).every(k=>tableColumns[name].includes(k)),'Coluna de backup inválida.');need(Object.values(record).every(v=>v==null||['string','boolean','number'].includes(typeof v)&&(!(typeof v==='number')||Number.isFinite(v))),'Valor de backup inválido.');need(!ids.has(record.id),'Identificador duplicado no backup.');ids.set(record.id,record);}indexes.set(name,ids);
 }
 for(const [name,records] of Object.entries(tables)) {
  if(runtimeTables.has(name))continue;
  for(const relation of tableRelations[name]||[])for(const record of records){const values=relation.columns.map(c=>record[c]);if(values.some(v=>v==null))continue;const target=tables[relation.target]||[];const exists=relation.targetColumns.length===1&&relation.targetColumns[0]==='id'?indexes.get(relation.target)?.has(values[0]):target.some(row=>relation.targetColumns.every((c,i)=>row[c]===values[i]));need(exists,'Relacionamento inválido no backup: '+name+'.');}
 }
 const totals=new Map();const sum=(name,key,id,field)=>{const token=name+':'+key+':'+field;if(!totals.has(token)){const values=new Map();for(const r of tables[name]||[])values.set(r[key],(values.get(r[key])||0)+Number(r[field]));totals.set(token,values);}return totals.get(token).get(id)||0;};
 for(const p of tables.packages||[])need(p.balance===p.credits-sum('credit_events','package_id',p.id,'units')+sum('package_adjustments','package_id',p.id,'units')&&p.balance>=0&&p.balance<=p.credits,'Saldo de pacote inconsistente.');
 for(const p of tables.products||[])need(p.stock===sum('stock_events','product_id',p.id,'quantity')&&p.stock>=0,'Estoque inconsistente.');
 for(const p of tables.lots||[])need(p.stock===sum('stock_events','lot_id',p.id,'quantity')&&p.stock>=0,'Lote inconsistente.');
 for(const bill of tables.invoices||[]){const paid=sum('payments','invoice_id',bill.id,'amount_cents');need(paid>=0&&paid<=bill.amount_cents,'Saldo financeiro inconsistente.');}
 for(const file of tables.files||[])if(file.pet_id&&file.health_id)need((tables.health||[]).some(h=>h.id===file.health_id&&h.pet_id===file.pet_id),'Comprovante sanitário incompatível.');
 for(const pet of tables.pets||[])if(pet.photo_id)need((tables.files||[]).some(f=>f.id===pet.photo_id&&f.pet_id===pet.id&&!f.removed_at),'Foto principal incompatível.');
 for(const file of tables.files||[])need(/^[\w-]{1,100}$/.test(file.id),'Identificador de arquivo inválido.');
 for(const file of tables.files||[])if(file.object_key)need(file.object_key==='files/'+file.id||file.object_key==='archive/files/'+file.id||new RegExp('^restored-files/[A-Za-z0-9_-]+/'+file.id+'$').test(file.object_key),'Localização de arquivo inválida.');
 return snapshot;
}
export function snapshotChunks(table,records,maxBytes=500000) {
 const chunks=[];let chunk=[],size=2;
 for(const record of records){const text=JSON.stringify(record),bytes=new TextEncoder().encode(text).length+1;if(chunk.length&&size+bytes>maxBytes){chunks.push(chunk);chunk=[];size=2;}if(bytes>maxBytes)throw Error('Registro grande demais para restauração: '+table);chunk.push(record);size+=bytes;}
 if(chunk.length)chunks.push(chunk);return chunks;
}
export function importStatement(db,table,records) {
 const columns=tableColumns[table].filter(c=>records.some(r=>Object.hasOwn(r,c)));
 const fields=columns.map(c=>{const fallback=columnDefaults[table]?.[c];return fallback===undefined?`json_extract(value,'$.${c}')`:`CASE WHEN json_type(value,'$.${c}') IS NULL THEN ${fallback} ELSE json_extract(value,'$.${c}') END`;}).join(',');
 return db.prepare(`INSERT INTO "${table}" (${columns.map(c=>'"'+c+'"').join(',')}) SELECT ${fields} FROM json_each(?)`).bind(JSON.stringify(records));
}
