import { models, operationalRead, permissionNames } from './models.mjs';
const uid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
export const localDate=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const parse=s=>JSON.parse(s||'{}');
async function boundedBody(request,max){const reader=request.body?.getReader();if(!reader)return new Uint8Array();let chunks=[],length=0;while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>max){await reader.cancel();throw new AppError('Arquivo ou formulário muito grande.',413);}chunks.push(part.value);}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;}
const safeUser=u=>u&&Object.fromEntries(Object.entries(u).filter(([k])=>!['identity_id'].includes(k)));
export class AppError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const need=(condition,message,status=400)=>{if(!condition)throw new AppError(message,status);};
export function can(user,domain,action='read'){
 if(!user?.active)return false;
 const custom=parse(user.permissions);
 if(custom[domain]?.[action]!==undefined)return custom[domain][action]===true;
 if(domain==='technical')return user.role==='technical';
 if(user.role==='management')return true;
 if(user.role==='operation')return ['operation','health'].includes(domain)&&['read','create','edit','cancel'].includes(action)||domain==='registry'&&action==='read';
 return false;
}
const permit=(u,p,a='read')=>need(can(u,p,a),'Você não tem permissão para esta ação.',403);
const stmt=(db,q,args=[])=>db.prepare(q).bind(...args);
const rows=async(db,q,args=[])=> (await stmt(db,q,args).all()).results;
const one=(db,q,args=[])=>stmt(db,q,args).first();
const insert=(db,table,data)=>stmt(db,`INSERT INTO ${table} (${Object.keys(data).join(',')}) VALUES (${Object.keys(data).map(()=>'?').join(',')})`,Object.values(data));
const update=(db,table,data,id)=>stmt(db,`UPDATE ${table} SET ${Object.keys(data).map(k=>`${k}=?`).join(',')} WHERE id=?`,[...Object.values(data),id]);
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(v=>v.toString(16).padStart(2,'0')).join('');
export async function hashPassword(password,salt=uid()){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);
 return `pbkdf2:100000:${salt}:${Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join('')}`;
}
async function verifyPassword(password,stored){
 const salt=stored?.split(':')[2];if(!salt)return false;
 const attempt=await hashPassword(password,salt);
 const a=new TextEncoder().encode(attempt),b=new TextEncoder().encode(stored);let diff=a.length^b.length;
 for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a[i]||0)^(b[i]||0);
 return diff===0;
}
const themeDefault={primary:'#316B5D',secondary:'#183C34',accent:'#EDB567',background:'#F7F8F5',text:'#1F302B',name:'Pet Day Care',logo_id:null,favicon_id:null,dark:false};
async function currentUser(db,request){
 const identity=request.headers.get('oai-authenticated-user-id');const email=request.headers.get('oai-authenticated-user-email')?.toLowerCase();
 need(identity&&email,'Entre com sua conta ChatGPT para continuar.',401);
 let user=await one(db,'SELECT * FROM users WHERE identity_id=?',[identity]);
 if(!user){user=await one(db,'SELECT * FROM users WHERE lower(email)=? AND identity_id IS NULL AND active=1',[email]);
 if(user){await stmt(db,'UPDATE users SET identity_id=? WHERE id=? AND identity_id IS NULL',[identity,user.id]).run();user=await one(db,'SELECT * FROM users WHERE identity_id=?',[identity]);}}
 return {user,identity,email};
}
export function priceBoarding(snapshot,start,end,size){
 const service=snapshot.service;need(service.boarding_policy&&service.partial_policy,'Configure as regras de cobrança da hospedagem.');
 const hours=(new Date(end)-new Date(start))/3600000;need(hours>0,'A saída deve ser posterior à entrada.');
 let total=0;
 const rateAt=date=>{const day=localDate(new Date(date));const matching=snapshot.seasons.filter(s=>s.size===size&&s.start_date<=day&&s.end_date>=day);need(matching.length<=1,'Temporadas sobrepostas para o porte selecionado.');const p=matching[0]?.price_cents??service.price_cents;need(Number.isInteger(p)&&p>=0,'Configure o preço da hospedagem para este período.');return p;};
 const full=Math.floor(hours/24);let rest=hours-full*24;
 for(let i=0;i<full;i++)total+=rateAt(service.boarding_policy==='arrival_rate'?start:new Date(new Date(start).getTime()+i*86400000));
 rest=Math.max(0,rest-(service.tolerance_minutes||0)/60);
 if(rest>0){const day=new Date(new Date(start).getTime()+full*86400000);if(service.partial_policy==='ceil_day')total+=rateAt(service.boarding_policy==='arrival_rate'?start:day);else{need(Number.isInteger(service.extra_hour_cents)&&service.extra_hour_cents>=0,'Configure o preço da hora adicional.');total+=Math.ceil(rest)*service.extra_hour_cents;}}
 return total;
}
function cleanFields(table,body){
 const m=models[table];need(m,'Cadastro inválido.',404);let clean={};
 for(const [key,[label,type,required,choices]] of Object.entries(m.fields)){
  let value=body[key];
  if(type==='checkbox'){value=value?1:0;}
  else if(type==='number'||type==='money'){value=value===''||value==null?null:Number(value);if(value!=null){need(Number.isFinite(value)&&value>=0,`${label}: informe um número positivo.`);if(key!=='weight')need(Number.isSafeInteger(value),`${label}: valor inválido.`);}}
  else {value=value==null||String(value).trim()===''?null:String(value).trim();need(value==null||value.length<=10000,`${label}: texto muito longo.`);}
  if(required)need(value!==null&&value!==undefined&&value!==''&&!(type==='checkbox'&&!value),`${label} é obrigatório.`);
  if(type==='select'&&value)need(choices.split('|').includes(value),`${label} inválido.`);
  if(type==='date'&&value)need(/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(new Date(value)),`${label} inválido.`);
  if(type==='email'&&value){value=value.toLowerCase();need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),'E-mail inválido.');}
  if(type==='url'&&value){let url;try{url=new URL(value);}catch{throw new AppError('URL inválida.');}need(['https:','http:'].includes(url.protocol)&&!url.password&&!url.username,'URL sem credenciais HTTP/HTTPS obrigatória.');}
  if(key==='phone'&&value){value=value.replace(/[^\d+]/g,'');need(value.length>=8,'Telefone inválido.');}
  clean[key]=value;
 }
 return clean;
}
async function stepUp(db,user,request){
 permit(user,'technical');const token=request.headers.get('cookie')?.match(/(?:^|;\s*)pet_technical=([^;]+)/)?.[1];
 need(token,'Digite a senha adicional da infraestrutura.',423);
 need(await one(db,'SELECT id FROM challenges WHERE user_id=? AND token_hash=? AND expires_at>?',[user.id,await digest(token),now()]),'A autorização técnica expirou. Digite a senha novamente.',423);
}
async function mutate(db,user,request,entity,id,statements,reason=null){
 const key=request.headers.get('idempotency-key');need(key&&/^[\w-]{16,100}$/.test(key),'Identificador da operação ausente. Recarregue a página.');
 const fingerprint=await digest(`${request.method}:${new URL(request.url).pathname}:${user.id}:${request.petFingerprint||''}`);
 const existing=await one(db,'SELECT * FROM request_keys WHERE id=?',[key]);
 if(existing){need(existing.actor_id===user.id&&existing.fingerprint===fingerprint,'Identificador de operação já utilizado.',409);return {ok:true,repeated:true,id:existing.result_id};}
 await db.batch([...statements,insert(db,'audit',{id:uid(),actor_id:user.id,action:request.method,entity,record_id:id,reason}),insert(db,'request_keys',{id:key,actor_id:user.id,fingerprint,result_id:id})]);
 return {ok:true,id};
}
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const financialKeys=['price_cents','cost_cents','quote_cents','base_cents','extras_cents','discount_cents','pricing','commission_value','commission_kind','commission_basis','commission_services','salary_cents'];
const hideMoney=(record,user)=>can(user,'finance')?record:Object.fromEntries(Object.entries(record).filter(([k])=>!financialKeys.includes(k)).map(([k,v])=>[k,k==='extras'?JSON.stringify(JSON.parse(v).map(e=>({id:e.id,name:e.name,duration_minutes:e.duration_minutes}))):v]));
export async function alerts(db,settings){
 const date=localDate(),soon=localDate(new Date(Date.now()+(settings.alert_days??15)*86400000));let output=[];
 for(const h of await rows(db,'SELECT h.*,p.name AS pet_name,p.photo_id,p.tutor_id FROM health h JOIN pets p ON p.id=h.pet_id WHERE p.archived=0 AND NOT EXISTS(SELECT 1 FROM health newer WHERE newer.pet_id=h.pet_id AND newer.kind=h.kind AND lower(newer.name)=lower(h.name) AND (newer.applied_date>h.applied_date OR (newer.applied_date=h.applied_date AND newer.created_at>h.created_at))) AND (h.due_date<=? OR h.proof_status=?)',[soon,'pendente']))output.push({id:h.id,type:'health',target:'health',pet_id:h.pet_id,tutor_id:h.tutor_id,title:`${h.pet_name} · ${h.name}`,detail:h.proof_status==='pendente'?'Comprovante pendente':`Próxima aplicação: ${h.due_date}`,priority:h.due_date<date?'alta':'normal'});
 for(const p of await rows(db,'SELECT k.*,p.name AS pet_name FROM packages k JOIN pets p ON p.id=k.pet_id WHERE k.balance<=2 OR substr(k.expires_at,1,10)<=?',[soon]))output.push({id:p.id,type:'package',target:'packages',pet_id:p.pet_id,title:`${p.pet_name} · ${p.name}`,detail:`${p.balance} créditos · validade ${p.expires_at.slice(0,10)}`,priority:p.balance===0?'alta':'normal'});
 for(const p of await rows(db,'SELECT * FROM products WHERE active=1 AND stock<=min_stock'))output.push({id:p.id,type:'inventory',target:'products',title:p.name,detail:`Estoque ${p.stock} · mínimo ${p.min_stock}`,priority:'alta'});
 for(const l of await rows(db,'SELECT l.*,p.name AS product_name FROM lots l JOIN products p ON p.id=l.product_id WHERE l.stock>0 AND l.expires_date<=?',[soon]))output.push({id:l.id,type:'inventory',target:'lots',title:`${l.product_name} · ${l.name}`,detail:`Validade ${l.expires_date}`,priority:l.expires_date<date?'alta':'normal'});
 for(const t of await rows(db,"SELECT * FROM tasks WHERE status='pendente' AND due_date<=?",[date]))output.push({id:t.id,type:'task',target:'tasks',title:t.name,detail:`Prazo ${t.due_date}`,priority:t.priority});
 for(const a of await rows(db,"SELECT a.*,p.name AS pet_name,s.kind,s.name AS service_name FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN services s ON s.id=a.service_id WHERE a.status='in_progress' AND a.end_at<?",[now()]))output.push({id:a.id,type:'appointment',target:'appointments',pet_id:a.pet_id,title:`${a.pet_name} · saída em atraso`,detail:a.service_name,priority:'alta'});
 for(const i of await rows(db,"SELECT i.*,i.amount_cents-COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0) AS remaining_cents FROM invoices i WHERE i.kind='receivable' AND i.due_date<?",[date]))if(i.remaining_cents>0)output.push({id:i.id,type:'finance',target:'finance',title:i.description,detail:'Pagamento em atraso',priority:'alta'});
 if(settings.require_health)for(const p of await rows(db,'SELECT id,name,tutor_id FROM pets WHERE archived=0 AND NOT EXISTS(SELECT 1 FROM health WHERE pet_id=pets.id)'))output.push({id:`missing-${p.id}`,type:'health',target:'health',pet_id:p.id,tutor_id:p.tutor_id,title:p.name,detail:'Nenhum registro sanitário cadastrado',priority:'alta'});
 return output;
}
async function state(db,user,organization){
 const settings=parse(organization.settings);const lists={};
 const visible=[];
 if(can(user,'registry'))visible.push('tutors','pets','contacts');
 if(can(user,'operation')||can(user,'settings'))visible.push('services','package_templates','packages','appointments');
 if(can(user,'health'))visible.push('health');
 if(can(user,'operation'))visible.push('activities','communications','tasks');
 if(can(user,'inventory'))visible.push('categories','suppliers','products','lots','orders','order_items','stock_events');
 if(can(user,'finance'))visible.push('invoices','payments','commissions');
 for(const table of visible){let data=await rows(db,`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 5000`);if(['tutors','pets'].includes(table))data=data.filter(r=>!r.archived);lists[table]=data.map(r=>hideMoney(r,user));}
 lists.users=(await rows(db,'SELECT * FROM users ORDER BY name')).map(u=>can(user,'team')?safeUser(u):{id:u.id,name:u.name,active:u.active,role:u.role});
 if(can(user,'settings')){lists.seasons=await rows(db,'SELECT * FROM seasons ORDER BY start_date');}
 const warnings=(await alerts(db,settings)).filter(a=>a.type!=='finance'||can(user,'finance')).filter(a=>a.type!=='inventory'||can(user,'inventory')).filter(a=>!['health','package','task','appointment'].includes(a.type)||can(user,a.type==='health'?'health':'operation'));
 return {user:safeUser(user),permissions:Object.fromEntries(Object.keys(permissionNames).map(p=>[p,Object.fromEntries(['read','create','edit','cancel','export','approve'].map(a=>[a,can(user,p,a)]))])),organization:{name:organization.name,theme:parse(organization.theme),settings:can(user,'settings')?settings:{capacities:settings.capacities,alert_days:settings.alert_days,require_health:settings.require_health}},lists,alerts:warnings,date:localDate(),limits:{records:5000}};
}
async function backupData(db,bucket,settings,actorId,automatic=false){
 need(bucket,'Armazenamento indisponível.',503);
 const tables=(await rows(db,"SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '__*' AND name NOT IN ('challenges','attempts','request_keys')")).map(t=>t.name);
 let size=0;
 for(const table of tables){const cols=(await rows(db,`PRAGMA table_info("${table}")`)).map(c=>c.name);const args=cols.map(c=>`'${c}',"${c}"`).join(',');const estimate=await one(db,`SELECT COALESCE(SUM(length(json_object(${args}))),0) AS bytes FROM "${table}"`);size+=estimate.bytes;need(size<=20*1024*1024,'Banco excede o limite de backup lógico. Use exportação D1 da infraestrutura.',413);}
 const batches=await db.batch(tables.map(table=>stmt(db,`SELECT * FROM "${table}"`)));
 const content={format:'pet-day-care-v1',created_at:now(),tables:Object.fromEntries(tables.map((t,i)=>[t,batches[i].results])),files_note:'Arquivos anexos devem ser copiados separadamente do R2.'};
 const id=uid(),objectKey=`backups/${id}.json`;
 await bucket.put(objectKey,JSON.stringify(content),{httpMetadata:{contentType:'application/json'}});
 try{await db.batch([insert(db,'backups',{id,name:`Backup ${automatic?'automático ':''}${localDate()}`,object_key:objectKey,actor_id:actorId}),insert(db,'audit',{id:uid(),actor_id:actorId,action:automatic?'backup_scheduled':'backup_manual',entity:'backups',record_id:id,reason:automatic?'Agendador autorizado da hospedagem':null})]);}catch(error){await bucket.delete(objectKey);throw error;}
 for(const old of await rows(db,'SELECT * FROM backups WHERE created_at<?',[new Date(Date.now()-(settings.backup_retention_days||30)*86400000).toISOString()])){await bucket.delete(old.object_key);await stmt(db,'DELETE FROM backups WHERE id=?',[old.id]).run();}
 return {ok:true,id,created_at:content.created_at};
}
export async function handleApi(request,env){
 try{return await dispatch(request,env);}catch(error){
  if(error instanceof AppError)return json({error:error.message},error.status);
  const message=String(error?.message||'');
  if(/UNIQUE constraint/.test(message))return json({error:'Este registro já existe. Confira telefone, e-mail, SKU ou a origem da operação.'},409);
  if(/FOREIGN KEY/.test(message))return json({error:'Um registro relacionado não existe ou foi alterado. Atualize a página.'},409);
  if(/CHECK constraint/.test(message))return json({error:'A operação violaria os saldos ou as regras do cadastro.'},409);
  const human=message.match(/(?:SQLITE_CONSTRAINT[^:]*:|D1_ERROR:|SQLITE_ERROR:)\s*(.*)/)?.[1]?.replace(/:\s*SQLITE_.*$/,'')||(error?.code==='ERR_SQLITE_ERROR'?message:null);
  if(human&&!/no such|syntax|SQLITE|database/i.test(human))return json({error:human},409);
  // Never log SQL parameters, personal records, request bodies or credentials.
  console.error(JSON.stringify({event:'api_failure',path:new URL(request.url).pathname.replace(/\/[\w-]{30,}/g,'/[id]'),class:error?.name||'Error'}));
  return json({error:'Não foi possível gravar ou consultar os dados. Nenhum sucesso foi confirmado. Tente novamente.'},500);
 }
}
async function dispatch(request,env){
 need(env.DB,'Banco de dados indisponível.',503);const db=env.DB;
 const path=new URL(request.url).pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);
 if(path[0]==='maintenance'&&path[1]==='backup'){
  const token=request.headers.get('X-Pet-Backup-Authorization');need(token&&env.BACKUP_SERVICE_HASH,'Backup automático não autorizado.',403);
  const actual=await digest(token),expected=env.BACKUP_SERVICE_HASH;let diff=actual.length^expected.length;for(let i=0;i<Math.max(actual.length,expected.length);i++)diff|=(actual.charCodeAt(i)||0)^(expected.charCodeAt(i)||0);need(diff===0,'Backup automático não autorizado.',403);
  if(request.method==='GET')return json({latest:await one(db,'SELECT id,name,created_at FROM backups ORDER BY created_at DESC LIMIT 1')});
  need(request.method==='POST','Método inválido.',405);const org=await one(db,'SELECT settings FROM organization LIMIT 1');
  return json(await backupData(db,env.BUCKET,org?parse(org.settings):{},null,true));
 }
 const {user,identity,email}=await currentUser(db,request);
 const organization=await one(db,'SELECT * FROM organization LIMIT 1');
 if(request.method!=='GET'){
  const origin=request.headers.get('origin');need(!origin||origin===new URL(request.url).origin,'Origem da requisição inválida.',403);
  need(Number(request.headers.get('content-length')||0)<=6*1024*1024,'Arquivo ou formulário muito grande.',413);
 }
 if(path[0]==='session')return json({configured:!!organization,authorized:!!user?.active,email,theme:organization?parse(organization.theme):themeDefault});
 let body={};
 if(!['GET','HEAD'].includes(request.method)&&path[0]!=='files'){
  need((request.headers.get('content-type')||'').includes('application/json'),'Formato JSON obrigatório.',415);
  const raw=new TextDecoder().decode(await boundedBody(request,60000));request.petFingerprint=await digest(raw);try{body=JSON.parse(raw);}catch{throw new AppError('Formulário inválido.');}
 }
 if(path[0]==='setup'&&request.method==='POST'){
  need(!organization,'A empresa já foi configurada.',409);need(body.name?.trim()&&body.user_name?.trim(),'Informe o nome da empresa e da responsável.');need(String(body.technical_password||'').length>=12,'A senha técnica precisa de pelo menos 12 caracteres.');
  const owner={id:uid(),identity_id:identity,email,name:body.user_name.trim(),role:'management',permissions:JSON.stringify({technical:Object.fromEntries(['read','create','edit','cancel','export','approve'].map(x=>[x,true]))}),active:1};
  const settings={capacities:{daycare:0,boarding:0,grooming:0,extra:0},alert_days:15,require_health:false,payment_methods:['PIX','Dinheiro','Cartão'],boarding_duration:null,backup_retention_days:30};
  const statements=[insert(db,'organization',{id:'main',name:body.name.trim(),settings:JSON.stringify(settings),theme:JSON.stringify({...themeDefault,name:body.name.trim()}),technical_hash:await hashPassword(body.technical_password)}),insert(db,'users',owner)];
  for(const name of ['Rações','Petiscos','Brinquedos','Medicamentos'])statements.push(insert(db,'categories',{id:uid(),name}));
  await db.batch(statements);return json({ok:true});
 }
 need(organization&&user?.active,'Acesso não autorizado. Solicite seu cadastro à gestão.',403);
 const settings=parse(organization.settings);
 if(path[0]==='state'&&request.method==='GET')return json(await state(db,user,organization));
 if(path[0]==='technical'&&path[1]==='unlock'&&request.method==='POST'){
  permit(user,'technical');need(String(body.password||'').length<=200,'Senha inválida.');
  const recent=await one(db,'SELECT COUNT(*) AS n FROM attempts WHERE user_id=? AND created_at>?',[user.id,new Date(Date.now()-900000).toISOString()]);need(recent.n<5,'Limite de tentativas atingido. Aguarde 15 minutos.',429);
  await insert(db,'attempts',{id:uid(),user_id:user.id}).run();
  const valid=await verifyPassword(String(body.password||''),organization.technical_hash);await insert(db,'audit',{id:uid(),actor_id:user.id,action:valid?'technical_unlock':'technical_failure',entity:'infrastructure',record_id:null,reason:null}).run();need(valid,'Senha adicional incorreta.',403);
  const token=uid()+uid();await insert(db,'challenges',{id:uid(),user_id:user.id,token_hash:await digest(token),expires_at:new Date(Date.now()+900000).toISOString()}).run();
  return json({ok:true},200,{'Set-Cookie':`pet_technical=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=900${new URL(request.url).protocol==='https:'?'; Secure':''}`});
 }
 if(path[0]==='technical'&&path[1]==='lock'&&request.method==='POST'){await stmt(db,'DELETE FROM challenges WHERE user_id=?',[user.id]).run();return json({ok:true},200,{'Set-Cookie':'pet_technical=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'});}
 if(path[0]==='technical'&&path[1]==='password'&&request.method==='POST'){
  await stepUp(db,user,request);need(String(body.password||'').length>=12,'Use pelo menos 12 caracteres.');return json(await mutate(db,user,request,'technical_password','main',[update(db,'organization',{technical_hash:await hashPassword(body.password)},'main'),stmt(db,'DELETE FROM challenges')]));
 }
 if(path[0]==='technical'&&request.method==='GET'){
  await stepUp(db,user,request);return json({infrastructure:await rows(db,'SELECT * FROM infrastructure ORDER BY created_at DESC'),audit:await rows(db,'SELECT a.*,u.name AS actor FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 500'),backups:await rows(db,'SELECT id,name,created_at FROM backups ORDER BY created_at DESC'),environment:{server:'Cloudflare Workers / Vinext',database:'Cloudflare D1',files:'R2 privado',publication:'Sites — acesso privado',secrets:'Variáveis de ambiente; valores não são expostos',multi_company:false,external_messages:'Não configuradas'}});
 }
 if(path[0]==='records'){
  const table=path[1],id=path[2],m=models[table];need(m,'Cadastro inexistente.',404);
  if(table==='infrastructure')await stepUp(db,user,request);
  if(request.method==='GET'){if(table==='services'||table==='package_templates'){permit(user,'operation');}else permit(user,m.permission);return json({records:(await rows(db,`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 5000`)).map(r=>hideMoney(r,user))});}
  permit(user,m.permission,id?'edit':'create');need(request.method==='POST'||request.method==='PATCH','Método inválido.',405);const clean=cleanFields(table,body);
  if(table==='health')need(clean.due_date>=clean.applied_date,'A próxima aplicação deve ser posterior à aplicação.');
  if(table==='seasons'){
   need(clean.end_date>=clean.start_date,'Período inválido.');need((await one(db,'SELECT kind FROM services WHERE id=?',[clean.service_id]))?.kind==='boarding','Selecione um serviço de hospedagem.');
   need(!await one(db,'SELECT id FROM seasons WHERE service_id=? AND size=? AND start_date<=? AND end_date>=? AND id!=?',[clean.service_id,clean.size,clean.end_date,clean.start_date,id||'']),'Há outra temporada neste intervalo para o mesmo porte.');
  }
  if(table==='services'){need(clean.duration_minutes>0&&clean.capacity>0,'Duração e capacidade precisam ser positivas.');if(clean.active)need(clean.kind==='boarding'||clean.price_cents!==null,'Configure o preço antes de ativar o serviço.');}
  if(table==='package_templates')need(clean.credits>0&&clean.valid_days>0,'Informe créditos e validade positivos.');
  if(table==='activities'&&clean.appointment_id)need(await one(db,"SELECT id FROM appointments WHERE id=? AND pet_id=? AND status='in_progress'",[clean.appointment_id,clean.pet_id]),'Selecione um atendimento em andamento deste pet.');
  if(id)need(await one(db,`SELECT id FROM ${table} WHERE id=?`,[id]),'Registro não encontrado.',404);
  if(!id&&['activities','communications'].includes(table))clean.actor_id=user.id;
  const recordId=id||uid();return json(await mutate(db,user,request,table,recordId,[id?update(db,table,clean,id):insert(db,table,{id:recordId,...clean})],body.reason));
 }
 if(path[0]==='archive'&&request.method==='POST'){
  const table=path[1],id=path[2];need(['pets','tutors'].includes(table),'Arquivo inválido.');permit(user,'registry','cancel');need(body.reason?.length>=5,'Informe a justificativa.');
  if(table==='pets')need(!await one(db,"SELECT id FROM appointments WHERE pet_id=? AND status IN ('scheduled','confirmed','in_progress')",[id]),'Encerre os agendamentos antes de arquivar.');
  if(table==='tutors')need(!await one(db,'SELECT id FROM pets WHERE tutor_id=? AND archived=0',[id]),'Arquive ou transfira os pets antes do tutor.');
  return json(await mutate(db,user,request,table,id,[update(db,table,{archived:1},id)],body.reason));
 }
 if(path[0]==='packages'&&request.method==='POST'){
  permit(user,'finance','create');const template=await one(db,'SELECT * FROM package_templates WHERE id=? AND active=1',[body.template_id]);need(template,'Pacote não disponível.');need(await one(db,'SELECT id FROM pets WHERE id=? AND archived=0',[body.pet_id]),'Pet inválido.');
  const id=uid(),expires=new Date(Date.now()+template.valid_days*86400000).toISOString();return json(await mutate(db,user,request,'packages',id,[insert(db,'packages',{id,pet_id:body.pet_id,template_id:template.id,service_id:template.service_id,name:template.name,credits:template.credits,price_cents:template.price_cents,balance:template.credits,expires_at:expires})]));
 }
 if(path[0]==='pet'&&request.method==='GET'){
  permit(user,'registry');const pet=await one(db,'SELECT * FROM pets WHERE id=?',[path[1]]);need(pet,'Pet não encontrado.',404);
  const history={pet,tutor:await one(db,'SELECT * FROM tutors WHERE id=?',[pet.tutor_id])};
  for(const table of ['contacts','health','appointments','packages','activities','files'])history[table]=(await rows(db,`SELECT * FROM ${table} WHERE pet_id=? ORDER BY created_at DESC`,[pet.id])).map(r=>hideMoney(r,user));
  history.credit_events=await rows(db,'SELECT c.* FROM credit_events c JOIN packages p ON p.id=c.package_id WHERE p.pet_id=? ORDER BY c.created_at DESC',[pet.id]);
  if(can(user,'finance'))history.invoices=await rows(db,'SELECT * FROM invoices WHERE tutor_id=? ORDER BY created_at DESC',[pet.tutor_id]);return json(history);
 }
 if(path[0]==='appointments'&&request.method==='POST'){
  permit(user,'operation','create');const pet=await one(db,'SELECT * FROM pets WHERE id=? AND archived=0',[body.pet_id]),service=await one(db,"SELECT * FROM services WHERE id=? AND active=1 AND kind!='extra'",[body.service_id]);need(pet&&service,'Selecione um pet e um serviço ativos.');
  need(!isNaN(new Date(body.start_at))&&!isNaN(new Date(body.end_at)),'Datas inválidas.');const start=new Date(body.start_at).toISOString(),end=new Date(body.end_at).toISOString();need(end>start,'A saída deve ser posterior à entrada.');
  const seasons=await rows(db,'SELECT * FROM seasons WHERE service_id=?',[service.id]);const pricing={service,seasons,size:pet.size,duration_basis:settings.boarding_duration};
  if(service.kind==='boarding')need(['planned','actual'].includes(settings.boarding_duration),'Defina se a hospedagem cobra o período previsto ou real nas configurações.');
  const base=service.kind==='boarding'?priceBoarding(pricing,start,end,pet.size):service.price_cents;need(Number.isInteger(base)&&base>=0,'Configure o preço do serviço.');
  const extras=[];need(Array.isArray(body.extras)&&body.extras.length<=20,'Adicionais inválidos.');
  for(const extraId of [...new Set(body.extras)]){const extra=await one(db,"SELECT id,name,price_cents,duration_minutes FROM services WHERE id=? AND kind='extra' AND active=1",[extraId]);need(extra&&Number.isInteger(extra.price_cents),'Serviço adicional indisponível.');extras.push(extra);}
  if(service.kind==='grooming')need((new Date(end)-new Date(start))/60000>=service.duration_minutes+extras.reduce((sum,e)=>sum+e.duration_minutes,0),'O intervalo precisa comportar a duração do serviço e dos adicionais.');
  if(service.kind==='daycare')need(localDate(new Date(start))===localDate(new Date(end)),'Creche deve começar e terminar no mesmo dia.');
  const extraTotal=extras.reduce((sum,e)=>sum+e.price_cents,0),discount=Number(body.discount_cents||0);need(Number.isSafeInteger(discount)&&discount>=0,'Desconto inválido.');if(discount)permit(user,'finance','approve');
  const units=service.kind==='boarding'?Math.ceil((new Date(end)-new Date(start))/86400000):1;
  const quote=(body.package_id?0:base)+extraTotal-discount;need(quote>=0,'Desconto acima do valor cobrado.');
  if(body.user_id)need(await one(db,'SELECT id FROM users WHERE id=? AND active=1',[body.user_id]),'Profissional inválido.');
  if(service.kind==='grooming')need(body.user_id,'Selecione a profissional de banho e tosa.');
  const id=uid();const data={id,pet_id:pet.id,service_id:service.id,user_id:body.user_id||null,package_id:body.package_id||null,start_at:start,end_at:end,status:body.waitlist?'waitlist':'scheduled',base_cents:base,quote_cents:quote,extras_cents:extraTotal,discount_cents:discount,extras:JSON.stringify(extras),credit_units:units,pricing:JSON.stringify(pricing),notes:String(body.notes||'').slice(0,10000),actor_id:user.id};
  return json(await mutate(db,user,request,'appointments',id,[insert(db,'appointments',data)]));
 }
 if(path[0]==='appointments'&&path[1]&&request.method==='PATCH'){
  permit(user,'operation','edit');const a=await one(db,'SELECT * FROM appointments WHERE id=?',[path[1]]);need(a,'Atendimento não encontrado.',404);const target=body.status;
  need(['confirmed','in_progress','completed','cancelled','no_show'].includes(target),'Situação inválida.');if(a.status===target)return json({ok:true,repeated:true,id:a.id});
  const data={status:target,actor_id:user.id};const pet=await one(db,'SELECT * FROM pets WHERE id=?',[a.pet_id]);
  if(target==='in_progress'){
   need(body.person?.trim(),'Identifique quem entregou o animal.');const authorized=[(await one(db,'SELECT name FROM tutors WHERE id=?',[pet.tutor_id]))?.name,...(await rows(db,'SELECT name FROM contacts WHERE pet_id=?',[pet.id])).map(x=>x.name)];need(authorized.some(n=>n?.toLowerCase()===body.person.trim().toLowerCase()),'Cadastre esta pessoa como responsável autorizado antes da entrada.');
   if(settings.require_health){const required=settings.required_vaccines||[];const health=await rows(db,"SELECT * FROM health WHERE pet_id=? AND proof_status='comprovado' AND due_date>=?",[pet.id,localDate()]);need(health.length>0&&required.every(name=>health.some(h=>h.name.toLowerCase()===name.toLowerCase())),'Há pendências sanitárias para a entrada. Confira registros e comprovantes.');}
   data.actual_in=now();data.delivered_by=body.person.trim();data.belongings=String(body.belongings||'').slice(0,10000);data.instructions=String(body.instructions||'').slice(0,10000);
  }
  if(target==='completed'){
   need(body.person?.trim(),'Identifique quem retirou o animal.');const authorized=[(await one(db,'SELECT name FROM tutors WHERE id=?',[pet.tutor_id]))?.name,...(await rows(db,'SELECT name FROM contacts WHERE pet_id=?',[pet.id])).map(x=>x.name)];need(authorized.some(n=>n?.toLowerCase()===body.person.trim().toLowerCase()),'A pessoa que retira precisa ser responsável autorizado.');
   data.actual_out=now();data.collected_by=body.person.trim();const snapshot=parse(a.pricing);let base=a.base_cents,units=a.credit_units;
   if(snapshot.service.kind==='boarding'&&snapshot.duration_basis==='actual'){base=priceBoarding(snapshot,a.actual_in,data.actual_out,snapshot.size);units=Math.ceil((new Date(data.actual_out)-new Date(a.actual_in))/86400000);}
   data.base_cents=base;data.credit_units=units;data.quote_cents=(a.package_id?0:base)+a.extras_cents-a.discount_cents;need(data.quote_cents>=0,'Revise o desconto antes de concluir.');
  }
  if(['cancelled','no_show'].includes(target)){permit(user,'operation','cancel');need(body.reason?.length>=5,'Justifique cancelamento ou falta.');data.notes=`${a.notes||''}\n${body.reason}`;}
  return json(await mutate(db,user,request,'appointments',a.id,[update(db,'appointments',data,a.id)],body.reason));
 }
 if(path[0]==='orders'&&request.method==='POST'){
  permit(user,'inventory','create');permit(user,'finance','create');need(['sale','purchase'].includes(body.kind),'Tipo de operação inválido.');need(Array.isArray(body.items)&&body.items.length>0&&body.items.length<=30,'Adicione de 1 a 30 itens.');
  const id=uid(),items=[];let total=0;
  if(body.pet_id)need(await one(db,'SELECT id FROM pets WHERE id=? AND tutor_id=?',[body.pet_id,body.tutor_id]),'Pet não pertence ao tutor selecionado.');
  if(body.kind==='purchase')need(body.supplier_id,'Selecione o fornecedor.');
  for(const input of body.items){const product=await one(db,'SELECT * FROM products WHERE id=? AND active=1',[input.product_id]);need(product,'Produto indisponível.');const quantity=Number(input.quantity),price=body.kind==='sale'?product.price_cents:Number(input.unit_cents);need(Number.isSafeInteger(quantity)&&quantity>0&&Number.isSafeInteger(price)&&price>=0,'Quantidade ou preço inválido.');
   if(input.lot_id&&body.kind==='sale'){const lot=await one(db,'SELECT * FROM lots WHERE id=?',[input.lot_id]);need(lot&&(!lot.expires_date||lot.expires_date>=localDate()),'Lote vencido ou inexistente.');}
   items.push({id:uid(),order_id:id,product_id:product.id,lot_id:input.lot_id||null,quantity,unit_cents:price});total+=quantity*price;
  }
  const discount=Number(body.discount_cents||0);need(Number.isSafeInteger(discount)&&discount>=0&&discount<=total,'Desconto inválido.');if(discount)permit(user,'finance','approve');
  const statements=[insert(db,'orders',{id,kind:body.kind,tutor_id:body.tutor_id||null,pet_id:body.pet_id||null,supplier_id:body.supplier_id||null,user_id:user.id,total_cents:total-discount,discount_cents:discount,notes:String(body.notes||'').slice(0,10000)}),...items.map(i=>insert(db,'order_items',i)),update(db,'orders',{status:'posted'},id)];return json(await mutate(db,user,request,'orders',id,statements));
 }
 if(path[0]==='stock'&&request.method==='POST'){
  permit(user,'inventory','approve');const quantity=Number(body.quantity);need(Number.isSafeInteger(quantity)&&quantity!==0,'Quantidade inválida.');need(body.reason?.length>=5,'Justifique o ajuste, perda, devolução ou inventário.');const id=uid();return json(await mutate(db,user,request,'stock_events',id,[insert(db,'stock_events',{id,product_id:body.product_id,lot_id:body.lot_id||null,quantity,reason:body.reason,actor_id:user.id})],body.reason));
 }
 if(path[0]==='invoices'&&request.method==='POST'){
  permit(user,'finance','create');need(['receivable','payable'].includes(body.kind),'Tipo inválido.');const amount=Number(body.amount_cents);need(Number.isSafeInteger(amount)&&amount>0&&body.description?.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(body.due_date),'Descrição, valor e vencimento obrigatórios.');const id=uid();return json(await mutate(db,user,request,'invoices',id,[insert(db,'invoices',{id,kind:body.kind,source_type:'manual',source_id:id,tutor_id:body.tutor_id||null,description:body.description.trim(),amount_cents:amount,due_date:body.due_date})]));
 }
 if(path[0]==='payments'&&request.method==='POST'){
  permit(user,'finance','create');const amount=Number(body.amount_cents);need(Number.isSafeInteger(amount)&&amount!==0,'Valor inválido.');need(settings.payment_methods.includes(body.method),'Forma de pagamento não configurada.');if(amount<0)permit(user,'finance','approve');const id=uid();return json(await mutate(db,user,request,'payments',id,[insert(db,'payments',{id,invoice_id:body.invoice_id,amount_cents:amount,method:body.method,reason:body.reason||null,actor_id:user.id})],body.reason));
 }
 if(path[0]==='users'&&['POST','PATCH'].includes(request.method)){
  permit(user,'team',path[1]?'edit':'create');permit(user,'team','approve');need(body.name?.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email||'')&&['management','operation','technical'].includes(body.role),'Nome, e-mail e perfil válidos obrigatórios.');
  const permissions=body.permissions||{};need(typeof permissions==='object'&&!Array.isArray(permissions),'Permissões inválidas.');for(const [domain,rules]of Object.entries(permissions)){need(domain in permissionNames&&typeof rules==='object','Permissão inválida.');for(const [action,value]of Object.entries(rules))need(['read','create','edit','cancel','export','approve'].includes(action)&&typeof value==='boolean','Permissão inválida.');}
  if(body.role==='technical'||permissions.technical&&Object.values(permissions.technical).some(Boolean)){permit(user,'technical','approve');await stepUp(db,user,request);}
  const data={name:body.name.trim(),email:body.email.trim().toLowerCase(),role:body.role,permissions:JSON.stringify(permissions),active:body.active?1:0,salary_cents:Number(body.salary_cents||0),commission_kind:body.commission_kind||'none',commission_value:Number(body.commission_value||0),commission_basis:body.commission_basis||'charged',commission_services:JSON.stringify(body.commission_services||[])};
  need(['none','fixed','percent'].includes(data.commission_kind)&&['charged','allocated'].includes(data.commission_basis),'Regra de comissão inválida.');need(Number.isSafeInteger(data.commission_value)&&data.commission_value>=0&&(data.commission_kind!=='percent'||data.commission_value<=10000)&&Number.isSafeInteger(data.salary_cents)&&data.salary_cents>=0,'Valor de remuneração ou comissão inválido.');
  if(path[1]===user.id)need(data.active&&data.role==='management'&&(permissions.team?.approve!==false),'Não remova seu próprio acesso de gestão.');const id=path[1]||uid();return json(await mutate(db,user,request,'users',id,[path[1]?update(db,'users',data,id):insert(db,'users',{id,...data})],body.reason));
 }
 if(path[0]==='settings'&&request.method==='POST'){
  permit(user,'settings','edit');const next={...settings,...body};need(Object.keys(next.capacities||{}).every(k=>['daycare','boarding','grooming','extra'].includes(k))&&['daycare','boarding','grooming'].every(k=>Number.isSafeInteger(next.capacities?.[k])&&next.capacities[k]>=0),'Capacidades inválidas.');
  need(Number.isSafeInteger(next.alert_days)&&next.alert_days>=0&&next.alert_days<=365,'Antecedência inválida.');need(Array.isArray(next.payment_methods)&&next.payment_methods.length&&next.payment_methods.every(x=>typeof x==='string'&&x.length>0&&x.length<=60),'Formas de pagamento inválidas.');need([null,'planned','actual'].includes(next.boarding_duration),'Política de duração inválida.');need(Number.isSafeInteger(next.backup_retention_days)&&next.backup_retention_days>=7&&next.backup_retention_days<=365,'Retenção deve ficar entre 7 e 365 dias.');need(Array.isArray(next.required_vaccines||[])&&(next.required_vaccines||[]).every(s=>typeof s==='string'&&s.length<=100),'Lista de comprovantes inválida.');
  return json(await mutate(db,user,request,'settings','main',[update(db,'organization',{settings:JSON.stringify(next)},'main')]));
 }
 if(path[0]==='theme'&&request.method==='POST'){
  permit(user,'settings','edit');let theme=body.reset?themeDefault:{...parse(organization.theme),...body};
  for(const key of ['primary','secondary','accent','background','text'])need(/^#[0-9a-f]{6}$/i.test(theme[key]),'Cor inválida.');need(theme.name?.trim()&&theme.name.length<=100,'Informe o nome da empresa.');
  const luminance=color=>{const c=color.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  need(contrast(theme.text,theme.background)>=4.5&&contrast('#ffffff',theme.primary)>=4.5,'As cores precisam de contraste mínimo para leitura e botões.');
  for(const k of ['logo_id','favicon_id'])if(theme[k])need(await one(db,"SELECT id FROM files WHERE id=? AND kind='brand'",[theme[k]]),'Imagem de marca inválida.');
  return json(await mutate(db,user,request,'theme','main',[update(db,'organization',{theme:JSON.stringify(theme),name:theme.name},'main')]));
 }
 if(path[0]==='files'){
  need(env.BUCKET,'Armazenamento de arquivos indisponível.',503);
  if(request.method==='GET'){
   const file=await one(db,'SELECT * FROM files WHERE id=?',[path[1]]);need(file,'Arquivo não encontrado.',404);if(file.kind!=='brand')permit(user,'registry');const obj=await env.BUCKET.get(`files/${file.id}`);need(obj,'Conteúdo do arquivo indisponível.',404);return new Response(obj.body,{headers:{'Content-Type':file.mime,'Content-Disposition':`${file.mime.startsWith('image/')?'inline':'attachment'}; filename="arquivo.${file.mime==='application/pdf'?'pdf':file.mime.split('/')[1]}"`,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});
  }
  need(request.method==='POST','Método inválido.',405);const encoded=await boundedBody(request,6*1024*1024);request.petFingerprint=await digest(Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded))).join(','));const form=await new Response(encoded,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();const file=form.get('file'),kind=String(form.get('kind')||'document'),petId=form.get('pet_id'),healthId=form.get('health_id');need(['photo','document','brand','activity'].includes(kind),'Tipo de arquivo inválido.');permit(user,kind==='brand'?'settings':kind==='activity'?'operation':healthId?'health':'registry','edit');need(file&&typeof file.arrayBuffer==='function'&&file.size>0&&file.size<=5*1024*1024,'Envie um arquivo de até 5 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());let mime=null;if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)mime='image/jpeg';if(bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10')mime='image/png';if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')mime='image/webp';if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-')mime='application/pdf';need(mime&&(kind==='document'||mime!=='application/pdf'),'Formato permitido: JPEG, PNG, WebP e PDF para documentos.');
  if(kind!=='brand')need(await one(db,'SELECT id FROM pets WHERE id=?',[petId]),'Selecione o pet.');if(healthId)need(await one(db,'SELECT id FROM health WHERE id=? AND pet_id=?',[healthId,petId]),'Registro de saúde incompatível.');const id=uid();
  await env.BUCKET.put(`files/${id}`,bytes,{httpMetadata:{contentType:mime}});
  try{const result=await mutate(db,user,request,'files',id,[insert(db,'files',{id,pet_id:kind==='brand'?null:petId,health_id:healthId||null,kind,name:String(file.name).slice(0,150),mime,size:file.size,actor_id:user.id}),...(kind==='photo'?[update(db,'pets',{photo_id:id},petId)]:[])]);return json(result);}catch(error){await env.BUCKET.delete(`files/${id}`);throw error;}
 }
 if(path[0]==='report'&&request.method==='GET'){
  permit(user,'reports','read');const url=new URL(request.url);const from=url.searchParams.get('from')||'0000-01-01',to=url.searchParams.get('to')||'9999-12-31';need(/^\d{4}-\d{2}-\d{2}$/.test(from)&&/^\d{4}-\d{2}-\d{2}$/.test(to)&&to>=from,'Período inválido.');
  const report={appointments:await rows(db,"SELECT a.id,p.name AS pet,t.name AS tutor,s.name AS service,s.kind,u.name AS professional,a.start_at,a.end_at,a.status,a.package_id,a.quote_cents FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN tutors t ON t.id=p.tutor_id JOIN services s ON s.id=a.service_id LEFT JOIN users u ON u.id=a.user_id WHERE substr(a.start_at,1,10)>=? AND substr(a.start_at,1,10)<=? ORDER BY a.start_at",[from,to]),packages:await rows(db,'SELECT k.id,p.name AS pet,k.name,k.credits,k.balance,k.expires_at FROM packages k JOIN pets p ON p.id=k.pet_id')};
  for(const field of ['pet_id','tutor_id','service_id','user_id']){const value=url.searchParams.get(field);if(value){const matching=new Set((await rows(db,`SELECT a.id FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE ${field==='tutor_id'?'p.tutor_id':'a.'+field}=?`,[value])).map(a=>a.id));report.appointments=report.appointments.filter(a=>matching.has(a.id));}}
  if(can(user,'finance')){report.invoices=await rows(db,'SELECT i.*,COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0) AS paid_cents FROM invoices i WHERE substr(i.created_at,1,10)>=? AND substr(i.created_at,1,10)<=?',[from,to]);report.payments=await rows(db,'SELECT p.*,i.kind,i.description FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE substr(p.created_at,1,10)>=? AND substr(p.created_at,1,10)<=?',[from,to]);report.commissions=await rows(db,'SELECT c.*,u.name AS professional FROM commissions c JOIN users u ON u.id=c.user_id WHERE substr(c.created_at,1,10)>=? AND substr(c.created_at,1,10)<=?',[from,to]);}else report.appointments=report.appointments.map(r=>hideMoney(r,user));
  if(can(user,'inventory')){report.stock=await rows(db,'SELECT name,sku,stock,min_stock,cost_cents,price_cents FROM products');report.movements=await rows(db,'SELECT e.*,p.name AS product FROM stock_events e JOIN products p ON p.id=e.product_id WHERE substr(e.created_at,1,10)>=? AND substr(e.created_at,1,10)<=?',[from,to]);}
  if(url.searchParams.get('csv')){permit(user,'reports','export');const key=url.searchParams.get('csv');need(Array.isArray(report[key]),'Relatório inválido.');const data=report[key],keys=Object.keys(data[0]||{resultado:''});const escape=v=>'"'+String(v??'').replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')+'"';return new Response('\uFEFF'+[keys,...data.map(row=>keys.map(k=>row[k]))].map(row=>row.map(escape).join(';')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="relatorio.csv"','Cache-Control':'no-store'}});}
  return json(report);
 }
 if(path[0]==='backup'){
  await stepUp(db,user,request);permit(user,'technical','export');need(env.BUCKET,'Armazenamento indisponível.',503);
  if(request.method==='GET'){const backup=await one(db,'SELECT * FROM backups WHERE id=?',[path[1]]);need(backup,'Backup não encontrado.',404);const object=await env.BUCKET.get(backup.object_key);need(object,'Backup expirado.',404);return new Response(object.body,{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="pet-backup.json"','Cache-Control':'no-store'}});}
  need(request.method==='POST','Método inválido.',405);return json(await backupData(db,env.BUCKET,settings,user.id));
 }
 throw new AppError('Rota não encontrada.',404);
}
