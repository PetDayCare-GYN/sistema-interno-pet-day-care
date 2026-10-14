import {tableColumns} from '../db/columns.mjs';
import {runtimeTables,validateSnapshot,snapshotChunks,importStatement} from './snapshot.mjs';
import {sha256,crc32,zipStream} from './zip.mjs';
const encoder=new TextEncoder();
const objectBytes=async(bucket,key,need)=>{const object=await bucket.get(key);need(object,'Conteúdo do backup indisponível.',409);return new Uint8Array(await new Response(object.body).arrayBuffer());};
export async function deleteBackup(ctx,backup) {await ctx.bucket.delete(backup.object_key);await ctx.stmt(ctx.db,'DELETE FROM backups WHERE id=?',[backup.id]).run();}

export async function makeBackup(ctx) {
 const {db,bucket,settings,actorId,automatic,need,one,rows,stmt,insert,update,uid,now,localDate}=ctx;
 need(bucket,'Armazenamento indisponível.',503);
 const pending=await one(db,"SELECT * FROM backups WHERE status='preparing' ORDER BY created_at LIMIT 1");
 if(pending)return continueBackup(ctx,pending);
 const tables=Object.keys(tableColumns).filter(t=>!runtimeTables.has(t));
 const present=await rows(db,"SELECT name FROM sqlite_master WHERE type='table'");need(tables.every(t=>present.some(p=>p.name===t)),'Aplique todas as migrações antes do backup.',409);
 const estimates=tables.map(t=>stmt(db,`SELECT COALESCE(SUM(${tableColumns[t].map(c=>`length(CAST(json_quote("${c}") AS BLOB))`).join('+')}+${tableColumns[t].reduce((s,c)=>s+c.length+4,1)}),0) AS bytes FROM "${t}"`));
 const size=(await db.batch(estimates)).reduce((sum,result)=>sum+result.results[0].bytes,0);need(size<=20*1024*1024,'Banco excede o limite de backup lógico. Use exportação da infraestrutura.',413);
 await stmt(db,"DELETE FROM maintenance_locks WHERE expires_at<?",[now()]).run();
 let locked=false,id;
 try {
  await insert(db,'maintenance_locks',{id:'backup',expires_at:new Date(Date.now()+30*60000).toISOString()}).run();locked=true;
  const batches=await db.batch(tables.map(t=>stmt(db,`SELECT * FROM "${t}"`)));
  const snapshot={format:'pet-day-care-v1',created_at:now(),tables:Object.fromEntries(tables.map((t,i)=>[t,batches[i].results])),file_manifest:[],files_note:'Os anexos têm cópias protegidas e verificadas. Baixe os ZIPs para manter uma cópia fora da hospedagem.'};
  validateSnapshot(snapshot,need);
  id=uid();const objectKey=`backups/${id}.json`,files=snapshot.tables.files.filter(f=>!f.removed_at);
  need(encoder.encode(JSON.stringify(snapshot)).length<=20*1024*1024,'Backup lógico muito grande.',413);
  for(const file of files)if(file.archive_hash&&file.archive_crc32!=null)snapshot.file_manifest.push({id:file.id,key:'archive/files/'+file.id,size:file.size,sha256:file.archive_hash,crc32:file.archive_crc32,mime:file.mime,name:file.name});
  await bucket.put(objectKey,JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'}});
  await insert(db,'backups',{id,name:`Backup ${automatic?'automático ':''}${localDate()}`,object_key:objectKey,actor_id:actorId,status:'preparing',file_count:files.length,copied_files:snapshot.file_manifest.length}).run();
  return await continueBackup(ctx,await one(db,'SELECT * FROM backups WHERE id=?',[id]));
 }catch(error){if(locked&&(!id||!await one(db,'SELECT id FROM backups WHERE id=?',[id]))){await stmt(db,"DELETE FROM maintenance_locks WHERE id='backup'").run();if(id)await bucket.delete('backups/'+id+'.json');}throw error;}
}
export async function continueBackup(ctx,backup) {
 const {db,bucket,need,stmt,insert,update,now,uid,rows,settings,actorId,automatic}=ctx;
 const snapshot=JSON.parse(new TextDecoder().decode(await objectBytes(bucket,backup.object_key,need)));
 const files=(snapshot.tables.files||[]).filter(f=>!f.removed_at),copied=new Set(snapshot.file_manifest.map(f=>f.id));
 for(const file of files.filter(f=>!copied.has(f.id)).slice(0,100)) {
  const bytes=await objectBytes(bucket,file.object_key||'files/'+file.id,need);need(bytes.length===file.size,'Um anexo mudou ou está incompleto.',409);
  const hash=await sha256(bytes),crc=crc32(bytes),key='archive/files/'+file.id;
  await bucket.put(key,bytes,{httpMetadata:{contentType:file.mime}});need(await sha256(await objectBytes(bucket,key,need))===hash,'A cópia de um anexo não foi confirmada.',503);
  Object.assign(file,{archive_hash:hash,archive_crc32:crc});snapshot.file_manifest.push({id:file.id,key,size:file.size,sha256:hash,crc32:crc,mime:file.mime,name:file.name});
  await update(db,'files',{archive_hash:hash,archive_crc32:crc},file.id).run();
 }
 await bucket.put(backup.object_key,JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'}});
 const complete=snapshot.file_manifest.length===files.length;
 await update(db,'backups',{copied_files:snapshot.file_manifest.length,status:'preparing'},backup.id).run();
 if(complete) {
  const references=snapshot.file_manifest.map(file=>({id:backup.id+'-'+file.id,backup_id:backup.id,file_id:file.id}));
  const statements=snapshotChunks('backup_files',references).map(records=>importStatement(db,'backup_files',records));
  if(statements.length)await db.batch([stmt(db,'DELETE FROM backup_files WHERE backup_id=?',[backup.id]),...statements]);
  await trialRecovery(ctx,snapshot);
  await update(db,'backups',{status:'complete',verified_at:now()},backup.id).run();
  await insert(db,'audit',{id:uid(),actor_id:actorId??backup.actor_id,action:automatic?'backup_scheduled':'backup_manual',entity:'backups',record_id:backup.id,reason:'Banco validado; '+files.length+' anexos com cópia protegida'}).run();
  await stmt(db,"DELETE FROM maintenance_locks WHERE id='backup'").run();
  const cutoff=new Date(Date.now()-(settings.backup_retention_days||30)*86400000).toISOString();
  for(const old of await rows(db,'SELECT * FROM backups WHERE created_at<? ORDER BY created_at LIMIT 20',[cutoff]))await deleteBackup(ctx,old);
  for(const file of await rows(db,'SELECT * FROM files WHERE removed_at IS NOT NULL AND removed_at<? AND NOT EXISTS(SELECT 1 FROM backup_files WHERE file_id=files.id) LIMIT 20',[cutoff]))await bucket.delete('archive/files/'+file.id);
 }
 return {ok:complete,id:backup.id,status:complete?'complete':'preparing',created_at:snapshot.created_at,file_count:files.length,copied_files:snapshot.file_manifest.length,needs_continuation:!complete};
}

export async function trialRecovery(ctx,snapshot) {
 validateSnapshot(snapshot,ctx.need);
 const triggers=await ctx.rows(ctx.db,"SELECT name,sql FROM sqlite_master WHERE type='trigger'");
 const probe='restore-probe-'+ctx.uid(),statements=[ctx.stmt(ctx.db,'PRAGMA defer_foreign_keys=ON'),ctx.insert(ctx.db,'maintenance_locks',{id:probe,expires_at:ctx.now()})];
 for(const trigger of triggers)statements.push(ctx.stmt(ctx.db,`DROP TRIGGER "${trigger.name}"`));
 for(const table of Object.keys(tableColumns).filter(t=>!runtimeTables.has(t)))statements.push(ctx.stmt(ctx.db,`DELETE FROM "${table}"`));
 for(const [table,records] of Object.entries(snapshot.tables))if(!runtimeTables.has(table))for(const chunk of snapshotChunks(table,records))statements.push(importStatement(ctx.db,table,chunk));
 for(const trigger of triggers)statements.push(ctx.stmt(ctx.db,trigger.sql));
 // The final duplicate deliberately aborts the entire batch. It is never a commit.
 statements.push(ctx.insert(ctx.db,'maintenance_locks',{id:probe,expires_at:ctx.now()}));
 ctx.need(statements.length<900,'Use recuperação pela infraestrutura para este volume.',413);
 try {await ctx.db.batch(statements);throw Error('O ensaio deveria ter sido revertido.');}
 catch(error){if(!/UNIQUE constraint failed: maintenance_locks\.id/.test(String(error.message)))throw error;}
 ctx.need(!await ctx.one(ctx.db,'SELECT id FROM maintenance_locks WHERE id=?',[probe]),'O rollback do ensaio não foi confirmado.',503);
 const files=snapshot.file_manifest||[];
 const day=Math.floor(Date.now()/86400000);
 for(let index=0;index<Math.min(2,files.length);index++){const file=files[(day*2+index)%files.length];ctx.need(await sha256(await objectBytes(ctx.bucket,file.key,ctx.need))===file.sha256,'Uma cópia de anexo falhou na conferência de recuperação.',409);}
}

export async function backupZip(ctx,backup,part=0) {
 const bytes=await objectBytes(ctx.bucket,backup.object_key,ctx.need),snapshot=JSON.parse(new TextDecoder().decode(bytes));
 ctx.need(backup.status==='complete'||!(snapshot.tables.files||[]).some(f=>!f.removed_at),'Conclua a cópia dos anexos antes de baixar o backup completo.',409);
 const files=snapshot.file_manifest||[],parts=Math.max(1,Math.ceil(files.length/250));ctx.need(Number.isSafeInteger(part)&&part>=0&&part<parts,'Parte de backup inválida.');
 const entries=[{name:'backup.json',size:bytes.length,crc:crc32(bytes),open:async()=>new Response(bytes).body}];
 for(const file of files.slice(part*250,(part+1)*250))entries.push({name:'files/'+file.id,size:file.size,crc:file.crc32,open:async()=>{const object=await ctx.bucket.get(file.key);ctx.need(object,'Anexo do backup indisponível.',409);return object.body;}});
 ctx.need(entries.reduce((s,e)=>s+e.size,0)<4000000000,'Parte de backup muito grande.',413);
 return new Response(zipStream(entries),{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="pet-backup-${backup.id}-parte-${part+1}-de-${parts}.zip"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
