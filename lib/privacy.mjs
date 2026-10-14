import {tableColumns} from '../db/columns.mjs';
import {redactTutor} from './recovery.mjs';
import {deleteBackup} from './backups.mjs';
import {replayOperation} from './operations.mjs';
const tablesForTutor=['tutors','pets','contacts','appointments','health','activities','communications','files','invoices','orders','payments','order_returns','audit'];
export async function handlePrivacy(ctx) {
 if(ctx.path[0]!=='privacy')return null;
 const {db,request,path,body,user,need,permit,one,rows,stmt,insert,update,mutate,uid,now,json,settings}=ctx;
 permit(user,'registry','read');
 if(path[1]==='export'&&request.method==='GET') {
  permit(user,'registry','export');const tutor=await one(db,'SELECT * FROM tutors WHERE id=?',[path[2]]);need(tutor,'Cadastro não encontrado.',404);
  const pets=await rows(db,'SELECT * FROM pets WHERE tutor_id=?',[tutor.id]),data={exported_at:now(),tutor,pets};
  if(pets.length)for(const [table,domain] of [['contacts','registry'],['files','registry'],['health','health'],['appointments','operation'],['packages','operation'],['activities','operation']])if(ctx.can(user,domain))data[table]=(await rows(db,`SELECT * FROM ${table} WHERE pet_id IN (SELECT id FROM pets WHERE tutor_id=?)`,[tutor.id])).map(r=>ctx.hideMoney(r,user));
  if(ctx.can(user,'finance')){data.invoices=await rows(db,'SELECT * FROM invoices WHERE tutor_id=?',[tutor.id]);data.payments=await rows(db,'SELECT p.* FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.tutor_id=?',[tutor.id]);}
  if(ctx.can(user,'operation'))data.communications=await rows(db,'SELECT * FROM communications WHERE tutor_id=?',[tutor.id]);
  await insert(db,'audit',{id:uid(),actor_id:user.id,action:'privacy_export',entity:'tutors',record_id:tutor.id,reason:'Exportação autorizada do cadastro'}).run();
  return new Response(JSON.stringify(data,null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="cadastro-tutor.json"','Cache-Control':'no-store'}});
 }
 if(path[1]==='candidates'&&request.method==='GET') {
  permit(user,'registry','delete');return json({records:await rows(db,'SELECT id,name,created_at,anonymized_at FROM tutors WHERE archived=1 ORDER BY created_at'),jobs:await rows(db,'SELECT id,tutor_id,status,created_at FROM privacy_jobs ORDER BY created_at DESC'),retention_days:settings.data_retention_days||null,policy:settings.privacy_policy||null});
 }
 if(path[1]==='remove'&&request.method==='POST') {
  permit(user,'registry','delete');permit(user,'finance','approve');
  const replay=await replayOperation(ctx);if(replay)return replay;
  need(settings.data_retention_days&&settings.privacy_policy?.trim(),'Defina a política e o prazo de retenção antes de remover dados pessoais.');
  need(body.confirmation==='REMOVER '+body.tutor_id&&body.reason?.trim().length>=5,'Confirme o cadastro e a justificativa da remoção.');
  need(!await one(db,"SELECT id FROM maintenance_locks WHERE expires_at>?",[now()]),'Há uma operação técnica em andamento. Aguarde sua conclusão.',409);
  const tutor=await one(db,'SELECT * FROM tutors WHERE id=? AND archived=1',[body.tutor_id]);need(tutor,'Arquive o tutor e seus pets antes da remoção.');
  need(!tutor.anonymized_at,'Os dados pessoais deste cadastro já foram removidos.');
  need(!await one(db,'SELECT id FROM pets WHERE tutor_id=? AND archived=0',[tutor.id]),'Há pets ativos vinculados a este tutor.');
  need(!await one(db,"SELECT a.id FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE p.tutor_id=? AND a.status IN ('scheduled','confirmed','in_progress','waitlist')",[tutor.id]),'Encerre as reservas e a espera antes da remoção.');
  need(!await one(db,'SELECT i.id FROM invoices i WHERE tutor_id=? AND amount_cents>COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0)',[tutor.id]),'Resolva os saldos financeiros antes da remoção.');
  const recent=await one(db,`SELECT MAX(moment) AS moment FROM (SELECT created_at AS moment FROM tutors WHERE id=? UNION ALL SELECT COALESCE(actual_out,created_at) FROM appointments WHERE pet_id IN (SELECT id FROM pets WHERE tutor_id=?) UNION ALL SELECT created_at FROM communications WHERE tutor_id=? UNION ALL SELECT p.created_at FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.tutor_id=?)`,[tutor.id,tutor.id,tutor.id,tutor.id]);
  need(Date.now()-new Date(recent.moment).getTime()>=settings.data_retention_days*86400000,'O prazo administrativo de retenção ainda não foi cumprido.');
  const scoped=table=>table==='tutors'?['id=?',[tutor.id]]:table==='pets'?['tutor_id=?',[tutor.id]]:['contacts','appointments','health','activities','files'].includes(table)?['pet_id IN (SELECT id FROM pets WHERE tutor_id=?)',[tutor.id]]:['communications','invoices','orders'].includes(table)?['tutor_id=?',[tutor.id]]:table==='payments'?['invoice_id IN (SELECT id FROM invoices WHERE tutor_id=?)',[tutor.id]]:table==='order_returns'?['order_id IN (SELECT id FROM orders WHERE tutor_id=?)',[tutor.id]]:['record_id IN (SELECT id FROM tutors WHERE id=? UNION SELECT id FROM pets WHERE tutor_id=? UNION SELECT id FROM appointments WHERE pet_id IN (SELECT id FROM pets WHERE tutor_id=?) UNION SELECT id FROM contacts WHERE pet_id IN (SELECT id FROM pets WHERE tutor_id=?) UNION SELECT id FROM health WHERE pet_id IN (SELECT id FROM pets WHERE tutor_id=?) UNION SELECT id FROM activities WHERE pet_id IN (SELECT id FROM pets WHERE tutor_id=?) UNION SELECT id FROM communications WHERE tutor_id=? UNION SELECT id FROM orders WHERE tutor_id=?)',Array(8).fill(tutor.id)];
  const batches=await db.batch(tablesForTutor.map(t=>{const [where,args]=scoped(t);return stmt(db,`SELECT * FROM ${t} WHERE ${where}`,args);})),tables=Object.fromEntries(tablesForTutor.map((t,i)=>[t,batches[i].results]));
  const linkedIds=tablesForTutor.filter(t=>t!=='audit').flatMap(t=>tables[t].map(r=>r.id));tables.audit=await rows(db,'SELECT * FROM audit WHERE record_id IN (SELECT value FROM json_each(?))',[JSON.stringify(linkedIds)]);
  const originals=structuredClone(tables),stamp=now();redactTutor(tables,tutor.id,stamp);const statements=[];
  const guard=await one(db,"SELECT sql FROM sqlite_master WHERE type='trigger' AND name='appointment_transition'");
  if(guard)statements.push(stmt(db,'DROP TRIGGER appointment_transition'));
  for(const table of tablesForTutor)for(const record of tables[table]){const previous=originals[table].find(r=>r.id===record.id);if(JSON.stringify(record)!==JSON.stringify(previous)){const changes=Object.fromEntries(Object.entries(record).filter(([key,value])=>key!=='id'&&previous[key]!==value&&tableColumns[table].includes(key)));statements.push(update(db,table,changes,record.id));}}
  const petIds=new Set(tables.pets.filter(p=>p.tutor_id===tutor.id).map(p=>p.id)),files=originals.files.filter(f=>petIds.has(f.pet_id)).map(f=>f.id);
  const id=uid();statements.push(insert(db,'privacy_jobs',{id,tutor_id:tutor.id,status:'pending',files:JSON.stringify(files),purge_backups:body.purge_backups?1:0,reason:body.reason.trim(),actor_id:user.id}));
  if(guard)statements.push(stmt(db,guard.sql));
  need(statements.length<850,'Use remoção assistida pela infraestrutura para este volume.',413);
  const result=await mutate(db,user,request,'privacy_jobs',id,statements,body.reason);return json({...result,status:'pending',notice:'Identificadores removidos; confirme a conclusão da limpeza dos arquivos.'});
 }
 if(path[1]==='finish'&&request.method==='POST') {
  permit(user,'registry','delete');permit(user,'finance','approve');const job=await one(db,'SELECT * FROM privacy_jobs WHERE id=?',[body.id]);need(job,'Solicitação não encontrada.',404);
  need(!await one(db,'SELECT id FROM maintenance_locks WHERE expires_at>?',[now()]),'Aguarde a operação técnica em andamento.',409);
  const ids=JSON.parse(job.files);
  if(job.purge_backups){const candidates=await rows(db,'SELECT * FROM backups WHERE created_at<=? AND id>? ORDER BY id LIMIT 20',[job.created_at,job.backup_cursor||'']);for(const backup of candidates){const object=await ctx.env.BUCKET.get(backup.object_key);if(object){const snapshot=JSON.parse(await new Response(object.body).text());if(snapshot.tables.tutors?.some(t=>t.id===job.tutor_id&&!t.anonymized_at))await deleteBackup({...ctx,bucket:ctx.env.BUCKET},backup);}}if(candidates.length){await update(db,'privacy_jobs',{backup_cursor:candidates.at(-1).id},job.id).run();if(candidates.length===20)return json({ok:false,id:job.id,status:'pending',processed_files:job.processed_files,total_files:ids.length});}}
  const selection=ids.slice(job.processed_files,job.processed_files+80),records=selection.length?await rows(db,'SELECT * FROM files WHERE id IN ('+selection.map(()=>'?').join(',')+')',selection):[];
  for(const file of records){await ctx.env.BUCKET.delete(file.object_key||'files/'+file.id);await ctx.env.BUCKET.delete('files/'+file.id);if(!await one(db,'SELECT id FROM backup_files WHERE file_id=? LIMIT 1',[file.id]))await ctx.env.BUCKET.delete('archive/files/'+file.id);}
  const processed=job.processed_files+selection.length,status=processed===ids.length?'complete':'pending';
  await stmt(db,'UPDATE privacy_jobs SET processed_files=?,status=? WHERE id=? AND processed_files=?',[processed,status,job.id,job.processed_files]).run();return json({ok:status==='complete',id:job.id,status,processed_files:processed,total_files:ids.length});
 }
 return null;
}
