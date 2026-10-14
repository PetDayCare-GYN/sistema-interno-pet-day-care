import {tableColumns} from '../db/columns.mjs';
import {runtimeTables,validateSnapshot,snapshotChunks,importStatement} from './snapshot.mjs';
import {sha256} from './zip.mjs';
const read=async(ctx,key)=>{const object=await ctx.env.BUCKET.get(key);ctx.need(object,'Arquivo de recuperação indisponível.',404);return new Uint8Array(await new Response(object.body).arrayBuffer());};
async function revision(ctx){return ctx.digest(JSON.stringify(await ctx.one(ctx.db,"SELECT (SELECT COUNT(*) FROM audit WHERE action NOT IN ('backup_manual','backup_scheduled')) AS count,(SELECT id FROM audit WHERE action NOT IN ('backup_manual','backup_scheduled') ORDER BY created_at DESC,id DESC LIMIT 1) AS latest")));}
export function redactTutor(tables,tutorId,stamp) {
 for(const t of tables.tutors||[])if(t.id===tutorId)Object.assign(t,{name:'Cadastro sem identificação '+t.id.slice(0,8),phone:'anon-'+t.id,email:null,address:null,emergency:null,notes:null,archived:1,anonymized_at:stamp});
 const pets=(tables.pets||[]).filter(p=>p.tutor_id===tutorId),petIds=new Set(pets.map(p=>p.id));
 for(const pet of pets)Object.assign(pet,{name:'Pet sem identificação '+pet.id.slice(0,8),photo_id:null,emergency:null,notes:null,behavior:null,allergies:null,diet:null,medication:null,archived:1});
 for(const c of tables.contacts||[])if(petIds.has(c.pet_id))Object.assign(c,{name:'Responsável sem identificação',phone:'anon-'+c.id,relationship:null});
 for(const a of tables.appointments||[])if(petIds.has(a.pet_id))Object.assign(a,{delivered_by:null,collected_by:null,belongings:null,instructions:null,notes:null,coat_condition:null,entry_notes:null,exit_notes:null});
 for(const name of ['health','activities'])for(const r of tables[name]||[])if(petIds.has(r.pet_id))r.notes=name==='activities'?'Registro com dados pessoais removidos':null;
 for(const c of tables.communications||[])if(c.tutor_id===tutorId)Object.assign(c,{notes:'Dados pessoais removidos',return_notes:null});
 for(const f of tables.files||[])if(petIds.has(f.pet_id))Object.assign(f,{removed_at:stamp,name:'Arquivo removido'});
 for(const i of tables.invoices||[])if(i.tutor_id===tutorId)i.description='Registro financeiro preservado · '+i.id.slice(0,8);
 const invoiceIds=new Set((tables.invoices||[]).filter(i=>i.tutor_id===tutorId).map(i=>i.id)),orderIds=new Set((tables.orders||[]).filter(o=>o.tutor_id===tutorId).map(o=>o.id));
 for(const p of tables.payments||[])if(invoiceIds.has(p.invoice_id))p.reason=p.reason?'Justificativa preservada sem identificadores pessoais':null;
 for(const o of tables.orders||[])if(o.tutor_id===tutorId)o.notes=null;
 for(const r of tables.order_returns||[])if(orderIds.has(r.order_id))r.reason='Devolução com identificadores pessoais removidos';
 const ids=new Set([tutorId,...petIds,...(tables.appointments||[]).filter(a=>petIds.has(a.pet_id)).map(a=>a.id),...(tables.contacts||[]).filter(a=>petIds.has(a.pet_id)).map(a=>a.id),...(tables.health||[]).filter(a=>petIds.has(a.pet_id)).map(a=>a.id),...(tables.activities||[]).filter(a=>petIds.has(a.pet_id)).map(a=>a.id),...(tables.communications||[]).filter(a=>a.tutor_id===tutorId).map(a=>a.id)]);
 for(const table of ['invoices','orders','order_returns','payments','files'])for(const record of tables[table]||[])if(table==='invoices'||table==='orders'?record.tutor_id===tutorId:table==='order_returns'?orderIds.has(record.order_id):table==='payments'?invoiceIds.has(record.invoice_id):petIds.has(record.pet_id))ids.add(record.id);
 for(const a of tables.audit||[])if(ids.has(a.record_id))Object.assign(a,{details:null,reason:'Detalhes pessoais removidos conforme solicitação administrativa'});
}

export async function handleRecovery(ctx) {
 if(ctx.path[0]!=='restoration')return null;
 const {request,db,path,body,user,need,permit,one,rows,stmt,insert,uid,now,json,stepUp}=ctx;
 await stepUp(db,user,request);permit(user,'technical','approve');permit(user,'technical','export');
 need(ctx.env.BUCKET,'Armazenamento indisponível.',503);
 if(path[1]==='preview'&&request.method==='POST') {
  const backup=await one(db,'SELECT * FROM backups WHERE id=?',[body.backup_id]);need(backup,'Backup não encontrado.',404);
  const snapshot=JSON.parse(new TextDecoder().decode(await read(ctx,backup.object_key)));validateSnapshot(snapshot,need);
  const files=(snapshot.tables.files||[]).filter(f=>!f.removed_at);
  need(backup.status==='complete'||files.length===0,'Este backup ainda não possui todos os anexos. Conclua a cópia primeiro.',409);
  need(files.every(f=>snapshot.file_manifest?.some(m=>m.id===f.id)),'Backup sem cópia de todos os anexos.',409);
  const id=uid(),plan={id,backup_id:backup.id,actor_id:user.id,created_at:now(),expires_at:new Date(Date.now()+30*60000).toISOString(),revision:await revision(ctx),snapshot_hash:await sha256(await read(ctx,backup.object_key)),verified_files:0,status:files.length?'verifying':'ready'};
  await ctx.env.BUCKET.put('restore-plans/'+id+'.json',JSON.stringify(plan));
  return json({id,backup_id:backup.id,status:plan.status,file_count:files.length,verified_files:0,counts:Object.fromEntries(Object.entries(snapshot.tables).filter(([t])=>!runtimeTables.has(t)).map(([t,records])=>[t,records.length])),created_at:snapshot.created_at,notice:'A recuperação preserva acessos atuais, senha técnica e solicitações de remoção de dados pessoais. Um backup de segurança será exigido antes da confirmação.'});
 }
 if(path[1]==='verify'&&request.method==='POST') {
  const plan=JSON.parse(new TextDecoder().decode(await read(ctx,'restore-plans/'+body.id+'.json')));need(plan.actor_id===user.id&&plan.expires_at>now(),'Plano expirado ou não autorizado.',403);
  const backup=await one(db,'SELECT * FROM backups WHERE id=?',[plan.backup_id]);need(backup,'Backup indisponível.',404);const snapshot=JSON.parse(new TextDecoder().decode(await read(ctx,backup.object_key))),files=snapshot.file_manifest||[];
  const erased=new Set((await rows(db,'SELECT files FROM privacy_jobs')).flatMap(j=>JSON.parse(j.files)));
  for(const file of files.slice(plan.verified_files,plan.verified_files+50)){if(erased.has(file.id))continue;const bytes=await read(ctx,file.key);need(await sha256(bytes)===file.sha256,'Anexo corrompido; a recuperação não foi iniciada.',409);await ctx.env.BUCKET.put('restored-files/'+plan.id+'/'+file.id,bytes,{httpMetadata:{contentType:file.mime}});}
  plan.expires_at=new Date(Date.now()+30*60000).toISOString();
  plan.verified_files=Math.min(files.length,plan.verified_files+50);plan.status=plan.verified_files===files.length?'ready':'verifying';await ctx.env.BUCKET.put('restore-plans/'+plan.id+'.json',JSON.stringify(plan));
  return json({id:plan.id,status:plan.status,file_count:files.length,verified_files:plan.verified_files});
 }
 if(path[1]==='commit'&&request.method==='POST') {
  need(body.confirmation==='RESTAURAR '+body.backup_id,'Digite a confirmação completa da recuperação.');
  need(await ctx.verifyPassword(String(body.password||''),ctx.organization.technical_hash),'A senha técnica não foi confirmada.',403);
  const plan=JSON.parse(new TextDecoder().decode(await read(ctx,'restore-plans/'+body.id+'.json')));need(plan.actor_id===user.id&&plan.backup_id===body.backup_id&&plan.expires_at>now(),'Plano expirado ou não autorizado.',403);
  if(plan.status==='complete')return json({ok:true,repeated:true,id:plan.id});
  need(plan.status==='ready','Confira todos os anexos antes da recuperação.',409);
  const safety=await one(db,"SELECT * FROM backups WHERE id=? AND status='complete' AND created_at>?",[body.safety_backup_id,plan.created_at]);need(safety&&safety.id!==plan.backup_id,'Crie um backup completo de segurança após a conferência.');
  await stmt(db,'DELETE FROM maintenance_locks WHERE expires_at<?',[now()]).run();
  await insert(db,'maintenance_locks',{id:'backup',expires_at:new Date(Date.now()+30*60000).toISOString()}).run();
  try {
  // Backup verification is recorded after preview; compare business changes only.
  need(await revision(ctx)===plan.revision,'Houve alterações após a conferência. Gere um novo plano de recuperação.',409);
  const backup=await one(db,'SELECT * FROM backups WHERE id=?',[plan.backup_id]);need(backup,'Backup indisponível.',404);const bytes=await read(ctx,backup.object_key);need(await sha256(bytes)===plan.snapshot_hash,'O backup mudou após a conferência.',409);
  const snapshot=JSON.parse(new TextDecoder().decode(bytes));
  const currentUsers=await rows(db,'SELECT * FROM users');
  for(const current of currentUsers){const prior=(snapshot.tables.users||[]).find(u=>u.id===current.id);if(prior)Object.assign(prior,{identity_id:current.identity_id,email:current.email,role:current.role,permissions:current.permissions,active:current.active});else (snapshot.tables.users||=[]).push(current);}
  if(!snapshot.tables.organization?.length)snapshot.tables.organization=[ctx.organization];else snapshot.tables.organization[0].technical_hash=ctx.organization.technical_hash;
  for(const job of await rows(db,"SELECT * FROM privacy_jobs WHERE status IN ('pending','complete')")){
   if(!(snapshot.tables.tutors||[]).some(t=>t.id===job.tutor_id)){const tombstone=await one(db,'SELECT * FROM tutors WHERE id=?',[job.tutor_id]);if(tombstone)(snapshot.tables.tutors||=[]).push(tombstone);}
   redactTutor(snapshot.tables,job.tutor_id,job.created_at);
  }
  for(const file of snapshot.file_manifest||[]){const metadata=snapshot.tables.files.find(f=>f.id===file.id);if(metadata&&!metadata.removed_at)metadata.object_key='restored-files/'+plan.id+'/'+file.id;}
  // Keep metadata referenced by safety backups without reactivating its documents.
  for(const current of await rows(db,'SELECT * FROM files'))if(!(snapshot.tables.files||[]).some(f=>f.id===current.id))(snapshot.tables.files||=[]).push({...current,pet_id:null,health_id:null,appointment_id:null,activity_id:null,removed_at:now()});
  validateSnapshot(snapshot,need);
  const triggers=await rows(db,"SELECT name,sql FROM sqlite_master WHERE type='trigger'"),statements=[stmt(db,'PRAGMA defer_foreign_keys=ON')];
  for(const trigger of triggers)statements.push(stmt(db,`DROP TRIGGER "${trigger.name}"`));
  for(const table of Object.keys(tableColumns).filter(t=>!runtimeTables.has(t)))statements.push(stmt(db,`DELETE FROM "${table}"`));
  for(const [table,records] of Object.entries(snapshot.tables))if(!runtimeTables.has(table))for(const chunk of snapshotChunks(table,records))statements.push(importStatement(db,table,chunk));
  for(const trigger of triggers)statements.push(stmt(db,trigger.sql));
  statements.push(insert(db,'audit',{id:uid(),actor_id:user.id,action:'restore',entity:'backups',record_id:backup.id,reason:'Recuperação confirmada; backup de segurança '+safety.id}),stmt(db,'DELETE FROM challenges'));
  need(statements.length<900,'Recupere este volume pela infraestrutura.',413);
  await db.batch(statements);plan.status='complete';await ctx.env.BUCKET.put('restore-plans/'+plan.id+'.json',JSON.stringify(plan));
  return json({ok:true,id:plan.id,preserved_access:true,technical_locked:true});
  } finally {await stmt(db,"DELETE FROM maintenance_locks WHERE id='backup'").run();}
 }
 return null;
}
