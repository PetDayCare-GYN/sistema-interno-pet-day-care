import { models, operationalRead, permissionNames } from './models.mjs';
import { tableColumns } from '../db/columns.mjs';
import { databaseRules } from '../db/rules.mjs';
import { handleOperations, enrichState, applyAlertStates } from './operations.mjs';
import { validateAvailability, validateExtraSettings } from './availability.mjs';
import { handleReports } from './reports.mjs';
import { makeBackup,backupZip } from './backups.mjs';
import {sha256,crc32} from './zip.mjs';
import {handleRecovery} from './recovery.mjs';
import {handlePrivacy} from './privacy.mjs';
import {extraAlerts,dashboardMetrics} from './alerts-extra.mjs';
import {infrastructureCatalog} from './infrastructure.mjs';
import {handlePetIdentity,enrichPetIdentity,requirePetPhoto,validatePetPhoto,canReadPetIdentity,identities} from './pet-identity.mjs';
const uid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
export const localDate=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const parse=s=>JSON.parse(s||'{}');
const auditSafe=value=>Array.isArray(value)?value.map(auditSafe):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!/(password|senha|token|secret|hash|identity_id)/i.test(k)).map(([k,v])=>[k,auditSafe(v)])):value;
async function installRules(db){for(const record of infrastructureCatalog)if(!await one(db,'SELECT id FROM infrastructure WHERE id=?',[record.id]))await insert(db,'infrastructure',{...record,updated_at:now()}).run();const definitions=databaseRules.map(sql=>({name:sql.match(/TRIGGER IF NOT EXISTS (\w+)/)[1],sql}));await db.batch(definitions.flatMap(rule=>[stmt(db,'DROP TRIGGER IF EXISTS '+rule.name),stmt(db,rule.sql)]));}

async function boundedBody(request,max){const reader=request.body?.getReader();if(!reader)return new Uint8Array();let chunks=[],length=0;while(true){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>max){await reader.cancel();throw new AppError('Arquivo ou formulário muito grande.',413);}chunks.push(part.value);}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;}
const safeUser=u=>u&&Object.fromEntries(Object.entries(u).filter(([k])=>!['identity_id','password_hash'].includes(k)));
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
const themeDefault={primary:'#316B5D',secondary:'#183C34',accent:'#EDB567',background:'#F7F8F5',text:'#1F302B',surface:'#FFFFFF',border:'#DCE4DA',muted:'#65736B',menu_bg:'#FFFFFF',menu_text:'#1F302B',name:'Pet Day Care',logo_id:null,favicon_id:null,dark:false};
async function currentUser(db,request){
 // Identidade vem dos headers oai-authenticated-user-* que, em produção, são
 // definidos pelo middleware de sessão (lib/auth.mjs) a partir do cookie
 // pet_session — os headers enviados pelo cliente são descartados lá. Nos testes,
 // handleApi é chamado direto (sem middleware) com os headers de identidade.
 const identity=request.headers.get('oai-authenticated-user-id');const email=request.headers.get('oai-authenticated-user-email')?.toLowerCase();
 if(!email)return {user:null,identity:null,email:null};
 const user=await one(db,'SELECT * FROM users WHERE lower(email)=? AND active=1',[email]);
 return {user,identity:user?.id||identity,email};
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
  else if(type==='number'||type==='money'){value=value===''||value==null?(['cancellation_fee_cents','no_show_fee_cents','tolerance_minutes'].includes(key)?0:null):Number(value);if(value!=null){need(Number.isFinite(value)&&value>=0,`${label}: informe um número positivo.`);if(key!=='weight')need(Number.isSafeInteger(value),`${label}: valor inválido.`);}}
  else {value=value==null||String(value).trim()===''?null:String(value).trim();need(value==null||value.length<=10000,`${label}: texto muito longo.`);}
  if(required)need(value!==null&&value!==undefined&&value!==''&&!(type==='checkbox'&&!value),`${label} é obrigatório.`);
  if(type==='select'&&value)need(choices.split('|').includes(value),`${label} inválido.`);
  if(type==='date'&&value)need(/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(new Date(value)),`${label} inválido.`);
  if(type==='datetime-local'&&value){const timestamp=new Date(/[Zz]$|[+-]\d\d:\d\d$/.test(value)?value:value+'-03:00');need(!isNaN(timestamp),`${label} inválido.`);value=timestamp.toISOString();}
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
 const authorization=await one(db,'SELECT expires_at FROM challenges WHERE user_id=? AND token_hash=? AND expires_at>?',[user.id,await digest(token),now()]);need(authorization,'A autorização técnica expirou. Digite a senha novamente.',423);return authorization;
}
async function mutate(db,user,request,entity,id,statements,reason=null){
 const key=request.headers.get('idempotency-key');need(key&&/^[\w-]{16,100}$/.test(key),'Identificador da operação ausente. Recarregue a página.');
 const fingerprint=await digest(`${request.method}:${new URL(request.url).pathname}:${user.id}:${request.petFingerprint||''}`);
 const existing=await one(db,'SELECT * FROM request_keys WHERE id=?',[key]);
 if(existing){need(existing.actor_id===user.id&&existing.fingerprint===fingerprint,'Identificador de operação já utilizado.',409);return {ok:true,repeated:true,id:existing.result_id};}
 need(!await one(db,'SELECT id FROM maintenance_locks WHERE expires_at>?',[now()]),'Há uma operação técnica em andamento. Aguarde sua conclusão.',409);
 const before=Object.hasOwn(tableColumns,entity)?await one(db,'SELECT * FROM '+entity+' WHERE id=?',[id]):['settings','theme','technical_password'].includes(entity)?await one(db,'SELECT * FROM organization LIMIT 1'):null;
 await db.batch([...statements,insert(db,'audit',{id:uid(),actor_id:user.id,action:request.method,entity,record_id:id,reason,details:JSON.stringify({before:auditSafe(before),change:auditSafe(request.petAudit||{})})}),insert(db,'request_keys',{id:key,actor_id:user.id,fingerprint,result_id:id})]);
 return {ok:true,id};
}
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const financialKeys=['price_cents','cost_cents','quote_cents','base_cents','extras_cents','discount_cents','pricing','commission_value','commission_kind','commission_basis','commission_services','salary_cents','bonus_value','amount_cents','original_invoice_cents','settled_cents','original_amount_cents','expected_cents','opening_cents','counted_cents','rule','snapshot'];
const hideMoney=(record,user)=>can(user,'finance')?record:Object.fromEntries(Object.entries(record).filter(([k])=>!financialKeys.includes(k)&&!k.endsWith('_cents')).map(([k,v])=>[k,['extras','performed_services'].includes(k)&&v?JSON.stringify(JSON.parse(v).map(e=>({id:e.id,name:e.name,duration_minutes:e.duration_minutes}))):v]));
export async function alerts(db,settings){
 const date=localDate(),lead=type=>localDate(new Date(Date.now()+(settings.alert_lead_days?.[type]??settings.alert_days??15)*86400000));let output=[];
 for(const h of await rows(db,'SELECT h.*,p.name AS pet_name,p.photo_id,p.tutor_id FROM health h JOIN pets p ON p.id=h.pet_id WHERE p.archived=0 AND NOT EXISTS(SELECT 1 FROM health newer WHERE newer.pet_id=h.pet_id AND newer.kind=h.kind AND lower(newer.name)=lower(h.name) AND (newer.applied_date>h.applied_date OR (newer.applied_date=h.applied_date AND newer.created_at>h.created_at))) AND (h.due_date<=? OR h.proof_status=?)',[lead('health'),'pendente']))output.push({id:h.id,type:'health',target:'health',pet_id:h.pet_id,tutor_id:h.tutor_id,title:`${h.pet_name} · ${h.name}`,detail:h.proof_status==='pendente'?'Comprovante pendente':`Próxima aplicação: ${h.due_date}`,priority:h.due_date<date?'alta':'normal'});
 for(const p of await rows(db,'SELECT k.*,p.name AS pet_name FROM packages k JOIN pets p ON p.id=k.pet_id WHERE k.balance<=2 OR substr(k.expires_at,1,10)<=?',[lead('package')]))output.push({id:p.id,type:'package',target:'packages',pet_id:p.pet_id,title:`${p.pet_name} · ${p.name}`,detail:`${p.balance} créditos · validade ${p.expires_at.slice(0,10)}`,priority:p.balance===0?'alta':'normal'});
 for(const p of await rows(db,'SELECT * FROM products WHERE active=1 AND stock<=min_stock'))output.push({id:p.id,type:'inventory',target:'products',title:p.name,detail:`Estoque ${p.stock} · mínimo ${p.min_stock}`,priority:'alta'});
 for(const l of await rows(db,'SELECT l.*,p.name AS product_name FROM lots l JOIN products p ON p.id=l.product_id WHERE l.stock>0 AND l.expires_date<=?',[lead('inventory')]))output.push({id:l.id,type:'inventory',target:'lots',title:`${l.product_name} · ${l.name}`,detail:`Validade ${l.expires_date}`,priority:l.expires_date<date?'alta':'normal'});
 for(const t of await rows(db,"SELECT * FROM tasks WHERE status='pendente' AND due_date<=?",[lead('task')]))output.push({id:t.id,type:'task',target:'tasks',title:t.name,detail:`Prazo ${t.due_date}`,priority:t.priority});
 for(const a of await rows(db,"SELECT a.*,p.name AS pet_name,s.kind,s.name AS service_name FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN services s ON s.id=a.service_id WHERE a.status='in_progress' AND a.end_at<?",[now()]))output.push({id:a.id,type:'appointment',target:'appointments',pet_id:a.pet_id,title:`${a.pet_name} · saída em atraso`,detail:a.service_name,priority:'alta'});
 for(const i of await rows(db,"SELECT i.*,i.amount_cents-COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0) AS remaining_cents FROM invoices i WHERE i.kind='receivable' AND i.due_date<=?",[lead('finance')]))if(i.remaining_cents>0)output.push({id:i.id,type:'finance',target:'finance',title:i.description,detail:i.due_date<date?'Pagamento em atraso':'Pagamento vence em '+i.due_date,priority:i.due_date<date?'alta':'normal'});
 if(settings.require_health)for(const p of await rows(db,'SELECT id,name,tutor_id FROM pets WHERE archived=0 AND NOT EXISTS(SELECT 1 FROM health WHERE pet_id=pets.id)'))output.push({id:`missing-${p.id}`,type:'health',target:'health',pet_id:p.id,tutor_id:p.tutor_id,title:p.name,detail:'Nenhum registro sanitário cadastrado',priority:'alta'});
 output.push(...await extraAlerts(db,settings,{rows,localDate,now}));return output;
}
async function state(db,user,organization){
 const settings=parse(organization.settings);const lists={};
 const visible=[];
 if(can(user,'registry'))visible.push('tutors','pets','contacts');
 if(can(user,'operation')||can(user,'settings'))visible.push('services','package_templates');
 if(can(user,'operation'))visible.push('packages','appointments');
 if(can(user,'health'))visible.push('health');
 if(can(user,'operation'))visible.push('activities','communications','tasks');
 if(can(user,'inventory'))visible.push('categories','suppliers','products','lots','orders','order_items','stock_events');
 if(can(user,'finance'))visible.push('invoices','payments','commissions');
 for(const table of visible){const data=await rows(db,`SELECT * FROM ${table}${['tutors','pets'].includes(table)?' WHERE archived=0':''} ORDER BY created_at DESC,id LIMIT 100`);lists[table]=data.map(r=>hideMoney(r,user));}
 lists.users=can(user,'team')||can(user,'operation')||can(user,'registry')?(await rows(db,'SELECT * FROM users ORDER BY name')).map(u=>can(user,'team')?safeUser(u):{id:u.id,name:u.name,active:u.active,role:u.role}):[];
 if(can(user,'settings')){lists.seasons=await rows(db,'SELECT * FROM seasons ORDER BY start_date');}
 const warnings=(await alerts(db,settings)).filter(a=>a.type!=='finance'||can(user,'finance')).filter(a=>a.type!=='inventory'||can(user,'inventory')).filter(a=>!['health','document','package','task','appointment','boarding'].includes(a.type)||can(user,['health','document'].includes(a.type)?'health':'operation'));
 return {user:hideMoney(safeUser(user),user),permissions:Object.fromEntries(Object.keys(permissionNames).map(p=>[p,Object.fromEntries(['read','create','edit','cancel','delete','export','approve'].map(a=>[a,can(user,p,a)]))])),organization:{name:organization.name,theme:{...themeDefault,...parse(organization.theme)},settings:can(user,'settings')?settings:{capacities:settings.capacities,alert_days:settings.alert_days,require_health:settings.require_health}},lists,alerts:await applyAlertStates({db,rows,digest,localDate},warnings),date:localDate(),limits:{records:100}};
}
async function backupData(db,bucket,settings,actorId,automatic=false){return makeBackup({db,bucket,settings,actorId,automatic,need,one,rows,stmt,insert,update,uid,now,localDate});}
// Backup automático diário, chamado pelo handler `scheduled` do Worker (Cron).
// Roda como código confiável do servidor: executa o backup direto (sem token) e
// repete enquanto houver continuação (cópia de anexos em lotes).
export async function runScheduledBackup(env){
 const db=env?.DB,bucket=env?.BUCKET;if(!db||!bucket)return {skipped:'bindings-indisponiveis'};
 const org=await one(db,'SELECT settings FROM organization LIMIT 1');if(!org)return {skipped:'nao-configurado'};
 const settings=parse(org.settings);let result,guard=0;
 do{result=await backupData(db,bucket,settings,null,true);guard++;}while(result?.needs_continuation&&guard<60);
 return result;
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
 if(path[0]==='maintenance'&&['backup','upgrade'].includes(path[1])){
  const token=request.headers.get('X-Pet-Backup-Authorization');need(token&&env.BACKUP_SERVICE_HASH,'Backup automático não autorizado.',403);
  const actual=await digest(token),expected=env.BACKUP_SERVICE_HASH;let diff=actual.length^expected.length;for(let i=0;i<Math.max(actual.length,expected.length);i++)diff|=(actual.charCodeAt(i)||0)^(expected.charCodeAt(i)||0);need(diff===0,'Backup automático não autorizado.',403);
  if(path[1]==='upgrade'){need(request.method==='POST','Método inválido.',405);await installRules(db);await insert(db,'audit',{id:uid(),actor_id:null,action:'rules_upgrade',entity:'infrastructure',reason:'Regras da versão instalada pela manutenção autenticada'}).run();return json({ok:true,rules:databaseRules.length});}
  if(request.method==='GET')return json({latest:await one(db,'SELECT id,name,created_at,status,file_count,copied_files,verified_at FROM backups ORDER BY created_at DESC LIMIT 1')});
  need(request.method==='POST','Método inválido.',405);const org=await one(db,'SELECT settings FROM organization LIMIT 1');
  return json(await backupData(db,env.BUCKET,org?parse(org.settings):{},null,true));
 }
 const {user,identity,email}=await currentUser(db,request);
 const organization=await one(db,'SELECT * FROM organization LIMIT 1');
 if(request.method!=='GET'){
  const origin=request.headers.get('origin');need(!origin||origin===new URL(request.url).origin,'Origem da requisição inválida.',403);
  need(Number(request.headers.get('content-length')||0)<=6*1024*1024,'Arquivo ou formulário muito grande.',413);
 }
 if(path[0]==='session')return json({configured:!!organization,authorized:!!user?.active,must_change_password:!!user?.must_change_password,email,theme:organization?{...themeDefault,...parse(organization.theme)}:themeDefault});
 let body={};
 if(!['GET','HEAD'].includes(request.method)&&!['files','pets'].includes(path[0])){
  need((request.headers.get('content-type')||'').includes('application/json'),'Formato JSON obrigatório.',415);
  const raw=new TextDecoder().decode(await boundedBody(request,60000));request.petFingerprint=await digest(raw);try{body=JSON.parse(raw);}catch{throw new AppError('Formulário inválido.');}request.petAudit=body;
 }
 if(path[0]==='setup'&&request.method==='POST'){
  need(!organization,'A empresa já foi configurada.',409);need(body.name?.trim()&&body.user_name?.trim(),'Informe o nome da empresa e da responsável.');need(String(body.technical_password||'').length>=12,'A senha técnica precisa de pelo menos 12 caracteres.');
  const ownerEmail=String(body.owner_email||email||'').toLowerCase().trim();need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail),'Informe um e-mail válido para o acesso da responsável.');const ownerPassword=String(body.password||'');need(!body.owner_email||ownerPassword.length>=8,'A senha de acesso precisa de pelo menos 8 caracteres.');
  const owner={id:uid(),identity_id:identity,email:ownerEmail,name:body.user_name.trim(),role:'management',permissions:JSON.stringify({technical:Object.fromEntries(['read','create','edit','cancel','export','approve'].map(x=>[x,true]))}),active:1,password_hash:ownerPassword?await hashPassword(ownerPassword):null};
  const settings={capacities:{daycare:0,boarding:0,grooming:0,extra:0},alert_days:15,require_health:false,payment_methods:['PIX','Dinheiro','Cartão'],boarding_duration:null,backup_retention_days:30};
  // Sites' migration transport splits trigger bodies at semicolons. Each rule
  // is therefore installed as one prepared statement during authorized initial
  // configuration, atomically with the organization. No tables are created here.
  const statements=[...databaseRules.map(sql=>stmt(db,sql)),insert(db,'organization',{id:'main',name:body.name.trim(),settings:JSON.stringify(settings),theme:JSON.stringify({...themeDefault,name:body.name.trim()}),technical_hash:await hashPassword(body.technical_password)}),insert(db,'users',owner)];
  for(const record of infrastructureCatalog)statements.push(insert(db,'infrastructure',{...record,updated_at:now()}));
  for(const name of ['Rações','Petiscos','Brinquedos','Medicamentos'])statements.push(insert(db,'categories',{id:uid(),name}));
  for(const name of ['Escovação dos dentes','Corte das unhas','Hidratação','Tosa higiênica','Tosa completa'])statements.push(insert(db,'services',{id:uid(),name,kind:'extra',price_cents:0,duration_minutes:15,capacity:99,active:1}));
  await db.batch(statements);return json({ok:true});
 }
 if(path[0]==='login'&&request.method==='POST'){
  need(organization,'A empresa ainda não foi configurada.',409);const loginEmail=String(body.login||body.email||'').toLowerCase().trim(),loginPassword=String(body.password||'');need(loginEmail&&loginPassword,'Informe usuário e senha.');
  const recent=await one(db,'SELECT COUNT(*) AS n FROM login_attempts WHERE email=? AND created_at>?',[loginEmail,new Date(Date.now()-900000).toISOString()]);need(recent.n<5,'Muitas tentativas de acesso. Aguarde 15 minutos.',429);await insert(db,'login_attempts',{id:uid(),email:loginEmail}).run();
  const account=await one(db,'SELECT * FROM users WHERE (lower(username)=? OR lower(email)=?) AND active=1',[loginEmail,loginEmail]);const valid=!!account&&!!account.password_hash&&await verifyPassword(loginPassword,account.password_hash);
  await insert(db,'audit',{id:uid(),actor_id:valid?account.id:null,action:valid?'login':'login_failure',entity:'session'}).run();need(valid,'E-mail ou senha incorretos.',403);
  await stmt(db,'DELETE FROM login_attempts WHERE email=?',[loginEmail]).run();const token=uid()+uid();await insert(db,'sessions',{id:uid(),user_id:account.id,token_hash:await digest(token),expires_at:new Date(Date.now()+2592000000).toISOString()}).run();
  return json({ok:true},200,{'Set-Cookie':`pet_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${new URL(request.url).protocol==='https:'?'; Secure':''}`});
 }
 if(path[0]==='logout'&&request.method==='POST'){const token=request.headers.get('cookie')?.match(/(?:^|;\s*)pet_session=([^;]+)/)?.[1];if(token)await stmt(db,'DELETE FROM sessions WHERE token_hash=?',[await digest(token)]).run();return json({ok:true},200,{'Set-Cookie':'pet_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});}
 if(path[0]==='brand'&&request.method==='GET'){need(organization,'Marca não configurada.',404);const theme=parse(organization.theme);need([theme.logo_id,theme.favicon_id].includes(path[1]),'Imagem de marca não encontrada.',404);const file=await one(db,"SELECT * FROM files WHERE id=? AND kind='brand' AND removed_at IS NULL",[path[1]]);need(file&&env.BUCKET,'Imagem indisponível.',404);const object=await env.BUCKET.get(file.object_key||'files/'+file.id);need(object,'Imagem indisponível.',404);return new Response(object.body,{headers:{'Content-Type':file.mime,'Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});}
 need(email,'Entre com seu usuário e senha para continuar.',401);need(organization&&user?.active,'Acesso não autorizado. Solicite seu cadastro à gestão.',403);
 // Troca de senha do próprio usuário (também libera o bloqueio de primeiro acesso).
 if(path[0]==='account'&&path[1]==='password'&&request.method==='POST'){
  need(String(body.password||'').length>=8,'A nova senha precisa de pelo menos 8 caracteres.');need(String(body.password||'').length<=200,'Senha muito longa.');
  const passwordHash=await hashPassword(body.password);
  await stmt(db,'UPDATE users SET password_hash=?,must_change_password=0 WHERE id=?',[passwordHash,user.id]).run();
  await insert(db,'audit',{id:uid(),actor_id:user.id,action:'password_self_change',entity:'users',record_id:user.id}).run();
  return json({ok:true});
 }
 // Primeiro acesso: enquanto a senha padrão não for trocada, nada mais é liberado.
 need(!user.must_change_password,'Defina uma nova senha de acesso antes de continuar.',403);
 const settings=parse(organization.settings);
 const context={request,env,db,path,body,user,organization,settings,need,can,permit,rows,one,stmt,insert,update,mutate,json,uid,now,localDate,hideMoney,stepUp,priceBoarding,digest,alerts,verifyPassword,cleanFields,boundedBody};
 if(path[0]==='state'&&request.method==='GET'){const data=await enrichPetIdentity(context,await enrichState(context,await state(db,user,organization)));data.dashboard_metrics=await dashboardMetrics(context,data);return json(data);}
 if(path[0]==='users'&&path[2]==='password'&&request.method==='POST'){permit(user,'team','edit');const target=await one(db,'SELECT id FROM users WHERE id=?',[path[1]]);need(target,'Pessoa não encontrada.',404);need(String(body.password||'').length>=8,'A senha precisa de pelo menos 8 caracteres.');const passwordHash=await hashPassword(body.password);return json(await mutate(db,user,request,'users',path[1],[update(db,'users',{password_hash:passwordHash,must_change_password:path[1]===user.id?0:1},path[1]),stmt(db,'DELETE FROM sessions WHERE user_id=?',[path[1]])],'Senha de acesso redefinida'));}
 const petResponse=await handlePetIdentity(context);if(petResponse)return petResponse;
 const extraResponse=await handleOperations(context);if(extraResponse)return extraResponse;
 const reportResponse=await handleReports(context);if(reportResponse)return reportResponse;
 const recoveryResponse=await handleRecovery(context);if(recoveryResponse)return recoveryResponse;
 const privacyResponse=await handlePrivacy(context);if(privacyResponse)return privacyResponse;
 if(path[0]==='technical'&&path[1]==='upgrade'&&request.method==='POST'){await stepUp(db,user,request);permit(user,'technical','approve');await installRules(db);return json(await mutate(db,user,request,'infrastructure','rules',[],'Atualização autorizada das regras do sistema'));}
 if(path[0]==='technical'&&path[1]==='unlock'&&request.method==='POST'){
  permit(user,'technical');need(String(body.password||'').length<=200,'Senha inválida.');
  const recent=await one(db,'SELECT COUNT(*) AS n FROM attempts WHERE user_id=? AND created_at>?',[user.id,new Date(Date.now()-900000).toISOString()]);need(recent.n<5,'Limite de tentativas atingido. Aguarde 15 minutos.',429);
  await insert(db,'attempts',{id:uid(),user_id:user.id}).run();
  const valid=await verifyPassword(String(body.password||''),organization.technical_hash);await insert(db,'audit',{id:uid(),actor_id:user.id,action:valid?'technical_unlock':'technical_failure',entity:'infrastructure',record_id:null,reason:null}).run();need(valid,'Senha adicional incorreta.',403);
  await stmt(db,'DELETE FROM attempts WHERE user_id=?',[user.id]).run();
  const token=uid()+uid();await insert(db,'challenges',{id:uid(),user_id:user.id,token_hash:await digest(token),expires_at:new Date(Date.now()+900000).toISOString()}).run();
  return json({ok:true},200,{'Set-Cookie':`pet_technical=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=900${new URL(request.url).protocol==='https:'?'; Secure':''}`});
 }
 if(path[0]==='technical'&&path[1]==='lock'&&request.method==='POST'){await stmt(db,'DELETE FROM challenges WHERE user_id=?',[user.id]).run();return json({ok:true},200,{'Set-Cookie':'pet_technical=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'});}
 if(path[0]==='technical'&&path[1]==='password'&&request.method==='POST'){
  await stepUp(db,user,request);need(String(body.password||'').length>=12,'Use pelo menos 12 caracteres.');return json(await mutate(db,user,request,'technical_password','main',[update(db,'organization',{technical_hash:await hashPassword(body.password)},'main'),stmt(db,'DELETE FROM challenges')]));
 }
 if(path[0]==='technical'&&request.method==='GET'){
  const authorization=await stepUp(db,user,request);return json({expires_at:authorization.expires_at,infrastructure:await rows(db,'SELECT * FROM infrastructure ORDER BY created_at DESC'),audit:await rows(db,'SELECT a.*,u.name AS actor FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 500'),backups:await rows(db,'SELECT id,name,created_at,status,file_count,copied_files,verified_at FROM backups ORDER BY created_at DESC'),environment:{server:'Cloudflare Workers / Vinext',database:'Cloudflare D1',files:'R2 privado',publication:'Sites — acesso privado',secrets:'Variáveis de ambiente; valores não são expostos',multi_company:false,external_messages:'Não configuradas'}});
 }
 if(path[0]==='records'){
  const table=path[1],id=path[2],m=models[table];need(m,'Cadastro inexistente.',404);
  if(table==='infrastructure')await stepUp(db,user,request);
  if(request.method==='GET'){if(table==='services'||table==='package_templates'){need(can(user,'operation')||can(user,'settings'),'Você não tem permissão para esta consulta.',403);}else permit(user,m.permission);return json({records:(await rows(db,`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT 100`)).map(r=>hideMoney(r,user))});}
  permit(user,m.permission,id?'edit':'create');if(table==='pets'&&!id)need(false,'A fotografia é obrigatória. Use o formulário de cadastro com foto PNG ou JPEG/JPG.');need(request.method==='POST'||request.method==='PATCH','Método inválido.',405);const clean=cleanFields(table,table==='pets'&&id?{...await one(db,'SELECT * FROM pets WHERE id=?',[id]),...body}:body);
  if(['contacts','health','activities'].includes(table)&&clean.pet_id)await requirePetPhoto(context,clean.pet_id);
  if(['pets','contacts','health','activities','communications'].includes(table)){const tutorId=table==='pets'?clean.tutor_id:table==='communications'?clean.tutor_id:(await one(db,'SELECT tutor_id FROM pets WHERE id=?',[clean.pet_id]))?.tutor_id;need(!await one(db,'SELECT id FROM tutors WHERE id=? AND anonymized_at IS NOT NULL',[tutorId||'']),'Os identificadores deste cadastro foram removidos.');}
  if(table==='tutors'&&id)need(!await one(db,'SELECT id FROM tutors WHERE id=? AND anonymized_at IS NOT NULL',[id]),'Os identificadores deste cadastro foram removidos.');
  if(table==='health')need(clean.due_date>=clean.applied_date,'A próxima aplicação deve ser posterior à aplicação.');
  if(table==='infrastructure')clean.updated_at=now();
  if(table==='shifts'){need(clean.end_at>clean.start_at,'A escala deve terminar após o início.');need(await one(db,'SELECT id FROM users WHERE id=? AND active=1',[clean.user_id]),'Profissional inválido.');}
  if(table==='communications'&&clean.health_id)need(await one(db,'SELECT h.id FROM health h JOIN pets p ON p.id=h.pet_id WHERE h.id=? AND p.tutor_id=?',[clean.health_id,clean.tutor_id]),'O registro sanitário não pertence a este tutor.');
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
  await requirePetPhoto(context,body.pet_id);const id=uid(),expires=new Date(Date.now()+template.valid_days*86400000).toISOString();return json(await mutate(db,user,request,'packages',id,[insert(db,'packages',{id,pet_id:body.pet_id,template_id:template.id,service_id:template.service_id,name:template.name,credits:template.credits,price_cents:template.price_cents,balance:template.credits,expires_at:expires})]));
 }
 if(path[0]==='pet'&&request.method==='GET'){
  permit(user,'registry');const pet=await one(db,'SELECT * FROM pets WHERE id=?',[path[1]]);need(pet,'Pet não encontrado.',404);
  const history={pet_identity:(await identities(context,[pet.id]))[0],pet,tutor:await one(db,'SELECT * FROM tutors WHERE id=?',[pet.tutor_id])};
  for(const [table,domain] of [['contacts','registry'],['health','health'],['appointments','operation'],['packages','operation'],['activities','operation'],['files','registry']])history[table]=can(user,domain)?(await rows(db,`SELECT * FROM ${table} WHERE pet_id=? ${table==='files'?'AND removed_at IS NULL':''} ORDER BY created_at DESC`,[pet.id])).filter(r=>table!=='files'||!r.health_id||can(user,'health')).map(r=>hideMoney(r,user)):[];
  history.credit_events=await rows(db,'SELECT c.* FROM credit_events c JOIN packages p ON p.id=c.package_id WHERE p.pet_id=? ORDER BY c.created_at DESC',[pet.id]);
  if(can(user,'finance')){history.invoices=await rows(db,`SELECT i.*,COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0) AS paid_cents FROM invoices i WHERE (i.source_type IN ('appointment','cancellation') AND i.source_id IN (SELECT id FROM appointments WHERE pet_id=?)) OR (i.source_type='package' AND i.source_id IN (SELECT id FROM packages WHERE pet_id=?)) OR (i.source_type='sale' AND i.source_id IN (SELECT id FROM orders WHERE pet_id=?)) ORDER BY i.created_at DESC`,[pet.id,pet.id,pet.id]);history.payments=await rows(db,'SELECT p.* FROM payments p WHERE invoice_id IN (SELECT value FROM json_each(?)) ORDER BY created_at DESC',[JSON.stringify(history.invoices.map(i=>i.id))]);}return json(history);
 }
 if(path[0]==='appointments'&&request.method==='POST'){
  permit(user,'operation','create');const pet=await one(db,'SELECT * FROM pets WHERE id=? AND archived=0',[body.pet_id]),service=await one(db,"SELECT * FROM services WHERE id=? AND active=1 AND kind!='extra'",[body.service_id]);need(pet&&service,'Selecione um pet e um serviço ativos.');await requirePetPhoto(context,pet.id);
  need(!isNaN(new Date(body.start_at))&&!isNaN(new Date(body.end_at)),'Datas inválidas.');const start=new Date(body.start_at).toISOString(),end=new Date(body.end_at).toISOString();need(end>start,'A saída deve ser posterior à entrada.');
  const seasons=await rows(db,'SELECT * FROM seasons WHERE service_id=?',[service.id]);const pricing={service,seasons,size:pet.size,duration_basis:settings.boarding_duration};
  if(service.kind==='boarding')need(['planned','actual'].includes(settings.boarding_duration),'Defina se a hospedagem cobra o período previsto ou real nas configurações.');
  const base=service.kind==='boarding'?priceBoarding(pricing,start,end,pet.size):service.price_cents;need(Number.isInteger(base)&&base>=0,'Configure o preço do serviço.');
  const extras=[];need(Array.isArray(body.extras)&&body.extras.length<=20,'Adicionais inválidos.');
  for(const extraId of [...new Set(body.extras)]){const extra=await one(db,"SELECT id,name,price_cents,duration_minutes FROM services WHERE id=? AND kind='extra' AND active=1",[extraId]);need(extra&&Number.isInteger(extra.price_cents),'Serviço adicional indisponível.');extras.push(extra);}
  if(service.kind==='grooming')need((new Date(end)-new Date(start))/60000>=service.duration_minutes+extras.reduce((sum,e)=>sum+e.duration_minutes,0),'O intervalo precisa comportar a duração do serviço e dos adicionais.');
  if(service.kind==='daycare')need(localDate(new Date(start))===localDate(new Date(end)),'Creche deve começar e terminar no mesmo dia.');
  if(!body.waitlist)await validateAvailability(context,service,start,end,body.user_id||null);
  const extraTotal=extras.reduce((sum,e)=>sum+e.price_cents,0),discount=Number(body.discount_cents||0);need(Number.isSafeInteger(discount)&&discount>=0,'Desconto inválido.');if(discount)permit(user,'finance','approve');
  const units=service.kind==='boarding'?Math.ceil((new Date(end)-new Date(start))/86400000):1;
  const quote=(body.package_id?0:base)+extraTotal-discount;need(quote>=0,'Desconto acima do valor cobrado.');
  if(body.user_id)need(await one(db,'SELECT id FROM users WHERE id=? AND active=1',[body.user_id]),'Profissional inválido.');
  if(service.kind==='grooming')need(body.user_id,'Selecione a profissional de banho e tosa.');
  const id=uid();const data={id,pet_id:pet.id,service_id:service.id,user_id:body.user_id||null,package_id:body.package_id||null,start_at:start,end_at:end,status:body.waitlist?'waitlist':'scheduled',base_cents:base,quote_cents:quote,extras_cents:extraTotal,discount_cents:discount,extras:JSON.stringify(extras),credit_units:units,pricing:JSON.stringify(pricing),notes:String(body.notes||'').slice(0,10000),actor_id:user.id};
  return json(await mutate(db,user,request,'appointments',id,[insert(db,'appointments',data)]));
 }
 if(path[0]==='recurrences'&&!path[1]&&request.method==='POST'){
  permit(user,'operation','create');
  const pet=await one(db,'SELECT * FROM pets WHERE id=? AND archived=0',[body.pet_id]),service=await one(db,"SELECT * FROM services WHERE id=? AND active=1 AND kind='daycare'",[body.service_id]);need(pet&&service,'Selecione um pet e um serviço de creche ativos.');await requirePetPhoto(context,pet.id);
  const base=service.price_cents;need(Number.isInteger(base)&&base>=0,'Configure o preço da creche antes de criar recorrências.');
  const capacity=Number(settings.capacities?.daycare||0);need(capacity>0,'Configure a capacidade da creche antes de criar recorrências.');
  const weekdays=[...new Set((Array.isArray(body.weekdays)?body.weekdays:[]).map(Number))].filter(d=>Number.isInteger(d)&&d>=0&&d<=6);need(weekdays.length,'Selecione pelo menos um dia da semana.');
  need(/^\d{4}-\d{2}-\d{2}$/.test(String(body.start_date))&&/^\d{4}-\d{2}-\d{2}$/.test(String(body.end_date)),'Informe o período (datas de início e fim).');
  if(body.user_id)need(await one(db,'SELECT id FROM users WHERE id=? AND active=1',[body.user_id]),'Profissional inválido.');
  let pkg=null;if(body.package_id){pkg=await one(db,'SELECT * FROM packages WHERE id=? AND pet_id=? AND service_id=?',[body.package_id,pet.id,service.id]);need(pkg,'Pacote incompatível com o pet e o serviço de creche.');need(pkg.balance>=1,'O pacote selecionado está sem créditos disponíveis.');}
  const limit=new Date(String(body.end_date)+'T12:00:00Z');let cursor=new Date(String(body.start_date)+'T12:00:00Z');need(limit>=cursor,'A data final deve ser igual ou posterior à inicial.');need((limit-cursor)/86400000<=400,'Período muito longo. Reduza o intervalo.');
  const candidates=[];while(cursor<=limit){if(weekdays.includes(cursor.getUTCDay()))candidates.push(cursor.toISOString().slice(0,10));cursor=new Date(cursor.getTime()+86400000);}
  need(candidates.length,'Nenhuma data no período corresponde aos dias da semana escolhidos.');
  const booked=new Set((await rows(db,"SELECT start_at FROM appointments WHERE pet_id=? AND status IN ('scheduled','confirmed','in_progress') AND service_id IN (SELECT id FROM services WHERE kind='daycare')",[pet.id])).map(a=>localDate(new Date(a.start_at))));
  const dayCounts={};for(const a of await rows(db,"SELECT start_at FROM appointments WHERE status IN ('scheduled','confirmed','in_progress') AND service_id IN (SELECT id FROM services WHERE kind='daycare')")){const ds=localDate(new Date(a.start_at));dayCounts[ds]=(dayCounts[ds]||0)+1;}
  const expiry=pkg?new Date(pkg.expires_at):null;const skipped={ocupado:0,lotado:0,vencido:0};const dates=[];
  for(const ds of candidates){if(booked.has(ds)){skipped.ocupado++;continue;}if((dayCounts[ds]||0)>=capacity){skipped.lotado++;continue;}if(expiry&&new Date(ds+'T18:00:00-03:00')>expiry){skipped.vencido++;continue;}dates.push(ds);dayCounts[ds]=(dayCounts[ds]||0)+1;}
  need(dates.length,'Nenhuma data nova pôde ser agendada: o pet já tem creche nessas datas, a capacidade está cheia ou as datas passam da validade do pacote.');
  need(dates.length<=130,'São '+dates.length+' datas; reduza o período ou os dias (máximo 130 por recorrência).');
  const seasons=await rows(db,'SELECT * FROM seasons WHERE service_id=?',[service.id]);const pricing=JSON.stringify({service,seasons,size:pet.size,duration_basis:settings.boarding_duration});
  const recurrenceId=uid();const quote=body.package_id?0:base;
  const statements=dates.map(ds=>insert(db,'appointments',{id:uid(),pet_id:pet.id,service_id:service.id,user_id:body.user_id||null,package_id:body.package_id||null,start_at:new Date(ds+'T08:00:00-03:00').toISOString(),end_at:new Date(ds+'T18:00:00-03:00').toISOString(),status:'scheduled',base_cents:base,quote_cents:quote,extras_cents:0,discount_cents:0,extras:'[]',credit_units:1,pricing,notes:String(body.notes||'').slice(0,10000),actor_id:user.id,recurrence_id:recurrenceId}));
  const result=await mutate(db,user,request,'appointments',recurrenceId,statements,'Recorrência de creche: '+dates.length+' datas ('+dates[0]+' a '+dates[dates.length-1]+')');
  return json({...result,recurrence_id:recurrenceId,created:dates.length,skipped});
 }
 if(path[0]==='recurrences'&&path[1]&&path[2]==='cancel'&&request.method==='POST'){
  permit(user,'operation','cancel');const reason=String(body.reason||'').trim();need(reason.length>=5,'Informe a justificativa do cancelamento (mínimo 5 caracteres).');
  const appts=await rows(db,"SELECT id,notes FROM appointments WHERE recurrence_id=? AND status IN ('scheduled','confirmed','waitlist')",[path[1]]);need(appts.length,'Nenhum agendamento futuro nesta recorrência para cancelar.',404);
  const statements=appts.map(a=>update(db,'appointments',{status:'cancelled',notes:((a.notes?a.notes+' · ':'')+'Recorrência cancelada: '+reason).slice(0,10000)},a.id));
  return json({...await mutate(db,user,request,'appointments',path[1],statements,'Cancelamento de recorrência: '+appts.length+' datas'),cancelled:appts.length});
 }
 if(path[0]==='appointments'&&path[1]&&request.method==='PATCH'){
  permit(user,'operation','edit');const a=await one(db,'SELECT * FROM appointments WHERE id=?',[path[1]]);need(a,'Atendimento não encontrado.',404);const target=body.status;
  need(['confirmed','in_progress','completed','cancelled','no_show'].includes(target),'Situação inválida.');if(a.status===target)return json({ok:true,repeated:true,id:a.id});
  if(['confirmed','in_progress','completed'].includes(target))await requirePetPhoto(context,a.pet_id);
  const data={status:target,actor_id:user.id};const pet=await one(db,'SELECT * FROM pets WHERE id=?',[a.pet_id]);
  if(target==='in_progress'){
   need(body.person?.trim(),'Identifique quem entregou o animal.');const authorized=[(await one(db,'SELECT name FROM tutors WHERE id=?',[pet.tutor_id]))?.name,...(await rows(db,'SELECT name FROM contacts WHERE pet_id=?',[pet.id])).map(x=>x.name)];need(authorized.some(n=>n?.toLowerCase()===body.person.trim().toLowerCase()),'Cadastre esta pessoa como responsável autorizado antes da entrada.');
   if(settings.require_health){const required=settings.required_vaccines||[];const health=await rows(db,"SELECT * FROM health WHERE pet_id=? AND proof_status='comprovado' AND due_date>=?",[pet.id,localDate()]);need(health.length>0&&required.every(name=>health.some(h=>h.name.toLowerCase()===name.toLowerCase())),'Há pendências sanitárias para a entrada. Confira registros e comprovantes.');}
   const documents=await rows(db,"SELECT document_type FROM files WHERE pet_id=? AND kind='document' AND removed_at IS NULL",[pet.id]);need((settings.required_documents||[]).every(name=>documents.some(f=>f.document_type?.toLowerCase()===name.toLowerCase())),'Há documentos obrigatórios pendentes para a entrada.');
   data.actual_in=now();data.delivered_by=body.person.trim();data.belongings=String(body.belongings||'').slice(0,10000);data.instructions=String(body.instructions||'').slice(0,10000);
   data.entry_notes=String(body.entry_notes||'').slice(0,10000);data.coat_condition=String(body.coat_condition||'').slice(0,10000);
  }
  if(target==='completed'){
   need(body.person?.trim(),'Identifique quem retirou o animal.');const authorized=[(await one(db,'SELECT name FROM tutors WHERE id=?',[pet.tutor_id]))?.name,...(await rows(db,'SELECT name FROM contacts WHERE pet_id=?',[pet.id])).map(x=>x.name)];need(authorized.some(n=>n?.toLowerCase()===body.person.trim().toLowerCase()),'A pessoa que retira precisa ser responsável autorizado.');
   data.actual_out=now();data.collected_by=body.person.trim();const snapshot=parse(a.pricing);let base=a.base_cents,units=a.credit_units;
   if(snapshot.service.kind==='boarding'&&snapshot.duration_basis==='actual'){base=priceBoarding(snapshot,a.actual_in,data.actual_out,snapshot.size);units=Math.ceil((new Date(data.actual_out)-new Date(a.actual_in))/86400000);}
   let performed=JSON.parse(a.extras);
   if(body.performed_services!==undefined){need(Array.isArray(body.performed_services)&&body.performed_services.length<=20,'Serviços realizados inválidos.');performed=[];for(const extraId of [...new Set(body.performed_services)]){let extra=JSON.parse(a.extras).find(e=>e.id===extraId);if(!extra){permit(user,'finance','approve');extra=await one(db,"SELECT id,name,price_cents,duration_minutes FROM services WHERE id=? AND active=1 AND kind='extra'",[extraId]);}need(extra,'Serviço realizado indisponível.');performed.push(extra);}}
   const extraTotal=performed.reduce((s,e)=>s+e.price_cents,0);
   data.performed_services=JSON.stringify(performed);data.extras_cents=extraTotal;data.exit_notes=String(body.exit_notes||'').slice(0,10000);
   const discount=body.discount_cents===undefined?a.discount_cents:Number(body.discount_cents);if(body.discount_cents!==undefined)permit(user,'finance','approve');need(Number.isSafeInteger(discount)&&discount>=0,'Desconto final inválido.');
   data.discount_cents=discount;data.base_cents=base;data.credit_units=units;data.quote_cents=(a.package_id?0:base)+extraTotal-discount;need(data.quote_cents>=0,'Revise o desconto antes de concluir.');
  }
  if(['cancelled','no_show'].includes(target)){permit(user,'operation','cancel');need(body.reason?.length>=5,'Justifique cancelamento ou falta.');data.notes=`${a.notes||''}\n${body.reason}`;data.quote_cents=a.status==='waitlist'?0:Number(parse(a.pricing).service[target==='cancelled'?'cancellation_fee_cents':'no_show_fee_cents']||0);}
  return json(await mutate(db,user,request,'appointments',a.id,[update(db,'appointments',data,a.id)],body.reason));
 }
 if(path[0]==='orders'&&request.method==='POST'){
  permit(user,'inventory','create');permit(user,'finance','create');need(['sale','purchase'].includes(body.kind),'Tipo de operação inválido.');need(Array.isArray(body.items)&&body.items.length>0&&body.items.length<=30,'Adicione de 1 a 30 itens.');
  const id=uid(),items=[];let total=0;
  if(body.pet_id){need(await one(db,'SELECT id FROM pets WHERE id=? AND tutor_id=?',[body.pet_id,body.tutor_id]),'Pet não pertence ao tutor selecionado.');await requirePetPhoto(context,body.pet_id);}
  if(body.kind==='purchase')need(body.supplier_id,'Selecione o fornecedor.');
  for(const input of body.items){const product=await one(db,'SELECT * FROM products WHERE id=? AND active=1',[input.product_id]);need(product,'Produto indisponível.');const quantity=Number(input.quantity),price=body.kind==='sale'?product.price_cents:Number(input.unit_cents);need(Number.isSafeInteger(quantity)&&quantity>0&&Number.isSafeInteger(price)&&price>=0,'Quantidade ou preço inválido.');
   if(input.lot_id&&body.kind==='sale'){const lot=await one(db,'SELECT * FROM lots WHERE id=?',[input.lot_id]);need(lot&&(!lot.expires_date||lot.expires_date>=localDate()),'Lote vencido ou inexistente.');}
   items.push({id:uid(),order_id:id,product_id:product.id,lot_id:input.lot_id||null,quantity,unit_cents:price,cost_cents:body.kind==='purchase'?price:product.cost_cents});total+=quantity*price;
  }
  need(Number.isSafeInteger(total),'Valor total fora do limite aceito.');const discount=Number(body.discount_cents||0);need(Number.isSafeInteger(discount)&&discount>=0&&discount<=total,'Desconto inválido.');if(discount)permit(user,'finance','approve');
  const statements=[insert(db,'orders',{id,kind:body.kind,tutor_id:body.tutor_id||null,pet_id:body.pet_id||null,supplier_id:body.supplier_id||null,user_id:user.id,total_cents:total-discount,discount_cents:discount,notes:String(body.notes||'').slice(0,10000)}),...items.map(i=>insert(db,'order_items',i)),update(db,'orders',{status:'posted'},id)];return json(await mutate(db,user,request,'orders',id,statements));
 }
 if(path[0]==='stock'&&request.method==='POST'){
  permit(user,'inventory','approve');const quantity=Number(body.quantity);need(Number.isSafeInteger(quantity)&&quantity!==0,'Quantidade inválida.');need(body.reason?.length>=5,'Justifique o ajuste, perda, devolução ou inventário.');const kind=body.kind||'adjustment';need(['adjustment','loss','expired','return'].includes(kind),'Tipo de ajuste inválido.');const id=uid();return json(await mutate(db,user,request,'stock_events',id,[insert(db,'stock_events',{id,product_id:body.product_id,lot_id:body.lot_id||null,quantity,reason:body.reason,kind,actor_id:user.id})],body.reason));
 }
 if(path[0]==='invoices'&&request.method==='POST'){
  permit(user,'finance','create');need(['receivable','payable'].includes(body.kind),'Tipo inválido.');const amount=Number(body.amount_cents);need(Number.isSafeInteger(amount)&&amount>0&&body.description?.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(body.due_date),'Descrição, valor e vencimento obrigatórios.');if(body.category_id)need(await one(db,'SELECT id FROM financial_categories WHERE id=? AND kind=?',[body.category_id,body.kind==='receivable'?'income':'expense']),'Categoria financeira incompatível.');const id=uid();return json(await mutate(db,user,request,'invoices',id,[insert(db,'invoices',{id,kind:body.kind,source_type:'manual',source_id:id,tutor_id:body.tutor_id||null,party_user_id:body.party_user_id||null,category_id:body.category_id||null,description:body.description.trim(),amount_cents:amount,due_date:body.due_date})]));
 }
 if(path[0]==='payments'&&request.method==='POST'){
  permit(user,'finance','create');const amount=Number(body.amount_cents);need(Number.isSafeInteger(amount)&&amount!==0,'Valor inválido.');need(settings.payment_methods.includes(body.method),'Forma de pagamento não configurada.');if(amount<0)permit(user,'finance','approve');const id=uid();return json(await mutate(db,user,request,'payments',id,[insert(db,'payments',{id,invoice_id:body.invoice_id,amount_cents:amount,method:body.method,reason:body.reason||null,actor_id:user.id})],body.reason));
 }
 if(path[0]==='users'&&['POST','PATCH'].includes(request.method)){
  permit(user,'team',path[1]?'edit':'create');permit(user,'team','approve');need(body.name?.trim()&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email||'')&&['management','operation','technical'].includes(body.role),'Nome, e-mail e perfil válidos obrigatórios.');const hasUsername=body.username!==undefined&&String(body.username).trim()!=='';if(hasUsername)need(/^[a-z0-9._-]{2,40}$/.test(String(body.username).trim().toLowerCase()),'Informe um usuário de acesso válido (2 a 40 caracteres: letras, números, ponto, hífen ou sublinhado).');
  const permissions=body.permissions||{};need(typeof permissions==='object'&&!Array.isArray(permissions),'Permissões inválidas.');for(const [domain,rules]of Object.entries(permissions)){need(domain in permissionNames&&typeof rules==='object','Permissão inválida.');for(const [action,value]of Object.entries(rules))need(['read','create','edit','cancel','delete','export','approve'].includes(action)&&typeof value==='boolean','Permissão inválida.');}
  if(body.role==='technical'||permissions.technical&&Object.values(permissions.technical).some(Boolean)){permit(user,'technical','approve');await stepUp(db,user,request);}
  const data={name:body.name.trim(),email:body.email.trim().toLowerCase(),role:body.role,permissions:JSON.stringify(permissions),active:body.active?1:0,salary_cents:Number(body.salary_cents||0),commission_kind:body.commission_kind||'none',commission_value:Number(body.commission_value||0),commission_basis:body.commission_basis||'charged',commission_services:JSON.stringify(body.commission_services||[])};
  Object.assign(data,{job_title:String(body.job_title||'').slice(0,100),commission_period:body.commission_period||'monthly',commission_condition:body.commission_condition||'completed',commission_pay_after_period:body.commission_pay_after_period?1:0,bonus_kind:body.bonus_kind||'none',bonus_value:Number(body.bonus_value||0),bonus_target:Number(body.bonus_target||0)});
  if(hasUsername)data.username=String(body.username).trim().toLowerCase();
  need(['daily','weekly','monthly'].includes(data.commission_period)&&['completed','paid'].includes(data.commission_condition),'Apuração de comissão inválida.');
  need(['none','fixed','percent'].includes(data.bonus_kind)&&Number.isSafeInteger(data.bonus_value)&&data.bonus_value>=0&&Number.isSafeInteger(data.bonus_target)&&data.bonus_target>=0&&(data.bonus_kind!=='percent'||data.bonus_value<=10000)&&(data.bonus_kind==='none'||data.bonus_target>0),'Regra de bonificação inválida.');
  need(['none','fixed','percent'].includes(data.commission_kind)&&['charged','allocated'].includes(data.commission_basis),'Regra de comissão inválida.');need(Number.isSafeInteger(data.commission_value)&&data.commission_value>=0&&(data.commission_kind!=='percent'||data.commission_value<=10000)&&Number.isSafeInteger(data.salary_cents)&&data.salary_cents>=0,'Valor de remuneração ou comissão inválido.');
  if(path[1]===user.id)need(data.active&&data.role==='management'&&(permissions.team?.approve!==false),'Não remova seu próprio acesso de gestão.');const id=path[1]||uid();return json(await mutate(db,user,request,'users',id,[path[1]?update(db,'users',data,id):insert(db,'users',{id,...data})],body.reason));
 }
 if(path[0]==='settings'&&request.method==='POST'){
  permit(user,'settings','edit');const allowed=['capacities','alert_days','require_health','required_vaccines','boarding_duration','payment_methods','backup_retention_days','opening_hours','closed_dates','require_shifts','package_accounting','required_documents','alert_lead_days','data_retention_days','privacy_policy'];need(Object.keys(body).every(k=>allowed.includes(k)),'Configuração desconhecida.');const next={...settings,...body};need(Object.keys(next.capacities||{}).every(k=>['daycare','boarding','grooming','extra'].includes(k))&&['daycare','boarding','grooming'].every(k=>Number.isSafeInteger(next.capacities?.[k])&&next.capacities[k]>=0),'Capacidades inválidas.');
  need(Number.isSafeInteger(next.alert_days)&&next.alert_days>=0&&next.alert_days<=365,'Antecedência inválida.');need(Array.isArray(next.payment_methods)&&next.payment_methods.length&&next.payment_methods.every(x=>typeof x==='string'&&x.length>0&&x.length<=60),'Formas de pagamento inválidas.');need([null,'planned','actual'].includes(next.boarding_duration),'Política de duração inválida.');need(Number.isSafeInteger(next.backup_retention_days)&&next.backup_retention_days>=7&&next.backup_retention_days<=365,'Retenção deve ficar entre 7 e 365 dias.');need(Array.isArray(next.required_vaccines||[])&&(next.required_vaccines||[]).every(s=>typeof s==='string'&&s.length<=100),'Lista de comprovantes inválida.');
  validateExtraSettings(next,need);
  return json(await mutate(db,user,request,'settings','main',[update(db,'organization',{settings:JSON.stringify(next)},'main')]));
 }
 if(path[0]==='theme'&&request.method==='POST'){
  permit(user,'settings','edit');let theme=body.reset?{...themeDefault,name:organization.name}:{...themeDefault,...parse(organization.theme),...body};
  for(const key of ['primary','secondary','accent','background','text','surface','border','muted','menu_bg','menu_text'])need(/^#[0-9a-f]{6}$/i.test(theme[key]),'Cor inválida.');need(theme.name?.trim()&&theme.name.length<=100,'Informe o nome da empresa.');
  const luminance=color=>{const c=color.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  need(contrast(theme.text,theme.background)>=4.5&&contrast(theme.text,theme.surface)>=4.5&&contrast(theme.muted,theme.background)>=4.5&&contrast(theme.muted,theme.surface)>=4.5&&contrast(theme.menu_text,theme.menu_bg)>=4.5&&contrast('#ffffff',theme.primary)>=4.5,'As cores precisam de contraste mínimo para leitura e botões.');
  for(const k of ['logo_id','favicon_id'])if(theme[k])need(await one(db,"SELECT id FROM files WHERE id=? AND kind='brand'",[theme[k]]),'Imagem de marca inválida.');
  return json(await mutate(db,user,request,'theme','main',[update(db,'organization',{theme:JSON.stringify(theme),name:theme.name},'main')]));
 }
 if(path[0]==='files'){
  need(env.BUCKET,'Armazenamento de arquivos indisponível.',503);
  if(request.method==='GET'){
   const file=await one(db,'SELECT * FROM files WHERE id=? AND removed_at IS NULL',[path[1]]);need(file,'Arquivo não encontrado.',404);if(file.kind==='photo'&&await one(db,'SELECT id FROM pets WHERE photo_id=?',[file.id]))need(canReadPetIdentity(context),'Você não tem permissão para consultar esta fotografia.',403);else if(file.kind!=='brand')permit(user,['before','after','activity'].includes(file.kind)?'operation':file.health_id?'health':'registry');const obj=await env.BUCKET.get(file.object_key||`files/${file.id}`);need(obj,'Conteúdo do arquivo indisponível.',404);return new Response(obj.body,{headers:{'Content-Type':file.mime,'Content-Disposition':`${file.mime.startsWith('image/')?'inline':'attachment'}; filename="arquivo.${file.mime==='application/pdf'?'pdf':file.mime.split('/')[1]}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  need(request.method==='POST','Método inválido.',405);const encoded=await boundedBody(request,6*1024*1024);const form=await new Response(encoded,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();const file=form.get('file'),kind=String(form.get('kind')||'document'),petId=form.get('pet_id'),healthId=form.get('health_id'),appointmentId=form.get('appointment_id'),activityId=form.get('activity_id');need(['photo','document','brand','activity','before','after'].includes(kind),'Tipo de arquivo inválido.');permit(user,kind==='brand'?'settings':['activity','before','after'].includes(kind)?'operation':healthId?'health':'registry','edit');need(file&&typeof file.arrayBuffer==='function'&&file.size>0&&file.size<=5*1024*1024,'Envie um arquivo de até 5 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());let mime=null;if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)mime='image/jpeg';if(bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10')mime='image/png';if(new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')mime='image/webp';if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-')mime='application/pdf';need(mime&&(kind==='document'||mime!=='application/pdf'),'Formato permitido: JPEG, PNG, WebP e PDF para documentos.');
  if(kind==='photo')mime=validatePetPhoto(file,bytes,need);
  request.petFingerprint=await digest(JSON.stringify({kind,petId,healthId,appointmentId,activityId,name:file.name,size:file.size,mime,content:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).join(',')}));
  if(kind!=='brand')need(await one(db,'SELECT p.id FROM pets p JOIN tutors t ON t.id=p.tutor_id WHERE p.id=? AND t.anonymized_at IS NULL',[petId]),'Selecione um pet com cadastro identificado.');if(healthId)need(await one(db,'SELECT id FROM health WHERE id=? AND pet_id=?',[healthId,petId]),'Registro de saúde incompatível.');if(appointmentId)need(await one(db,'SELECT id FROM appointments WHERE id=? AND pet_id=?',[appointmentId,petId]),'Atendimento incompatível com o pet.');if(activityId)need(await one(db,'SELECT id FROM activities WHERE id=? AND pet_id=? AND (appointment_id IS NULL OR appointment_id=?)',[activityId,petId,appointmentId||null]),'Registro do diário incompatível.');if(['before','after'].includes(kind))need(appointmentId,'Vincule a foto ao atendimento.');if(kind==='brand')need(mime!=='image/webp','Use PNG ou JPEG para a identidade visual e os relatórios.');const id=uid();
  const archiveHash=await sha256(bytes),archiveCRC=crc32(bytes);await env.BUCKET.put(`files/${id}`,bytes,{httpMetadata:{contentType:mime}});try{await env.BUCKET.put('archive/files/'+id,bytes,{httpMetadata:{contentType:mime}});const archive=await env.BUCKET.get('archive/files/'+id);need(archive&&await sha256(new Uint8Array(await new Response(archive.body).arrayBuffer()))===archiveHash,'A cópia protegida do arquivo não foi confirmada.',503);}catch(error){await env.BUCKET.delete('files/'+id);await env.BUCKET.delete('archive/files/'+id);throw error;}
  try{const result=await mutate(db,user,request,'files',id,[insert(db,'files',{id,pet_id:kind==='brand'?null:petId,health_id:healthId||null,appointment_id:appointmentId||null,activity_id:activityId||null,archive_hash:archiveHash,archive_crc32:archiveCRC,document_type:kind==='document'?String(form.get('document_type')||'').slice(0,100):null,kind,name:String(file.name).slice(0,150),mime,size:file.size,actor_id:user.id}),...(kind==='photo'?[update(db,'pets',{photo_id:id},petId)]:[])]);if(result.repeated){await env.BUCKET.delete('files/'+id);await env.BUCKET.delete('archive/files/'+id);}return json(result);}catch(error){await env.BUCKET.delete('files/'+id);await env.BUCKET.delete('archive/files/'+id);throw error;}
 }
 if(path[0]==='backup'){
  await stepUp(db,user,request);permit(user,'technical','export');need(env.BUCKET,'Armazenamento indisponível.',503);
  if(request.method==='GET'){const backup=await one(db,'SELECT * FROM backups WHERE id=?',[path[1]]);need(backup,'Backup não encontrado.',404);const query=new URL(request.url).searchParams;if(query.has('zip'))return backupZip({db,bucket:env.BUCKET,need},backup,Number(query.get('part')||0));const object=await env.BUCKET.get(backup.object_key);need(object,'Backup expirado.',404);return new Response(object.body,{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="pet-backup.json"','Cache-Control':'no-store'}});}
  need(request.method==='POST','Método inválido.',405);return json(await backupData(db,env.BUCKET,settings,user.id));
 }
 throw new AppError('Rota não encontrada.',404);
}

