export async function extraAlerts(db,settings,{rows,localDate,now}) {
 const date=localDate(),output=[];
 const lead=type=>localDate(new Date(Date.now()+(settings.alert_lead_days?.[type]??settings.alert_days??15)*86400000));
 const records=await rows(db,"SELECT a.*,p.name AS pet_name,p.photo_id,p.tutor_id,t.name AS tutor_name,s.kind,s.name AS service_name FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN tutors t ON t.id=p.tutor_id JOIN services s ON s.id=a.service_id WHERE a.status IN ('scheduled','confirmed','in_progress')");
 for(const a of records) {
  const start=localDate(new Date(a.start_at)),end=localDate(new Date(a.end_at));
  if(['scheduled','confirmed'].includes(a.status)&&start>=date&&start<=lead('appointment'))output.push({id:a.id+':upcoming',type:'appointment',target:'appointments',pet_id:a.pet_id,tutor_id:a.tutor_id,title:a.pet_name+' · atendimento próximo',detail:a.service_name+' · '+start,priority:'normal'});
  if(a.status==='scheduled'&&start<=lead('appointment'))output.push({id:a.id+':confirmation',type:'appointment',target:'appointments',pet_id:a.pet_id,tutor_id:a.tutor_id,title:a.pet_name+' · confirmação pendente',detail:a.service_name+' · '+start,priority:start<date?'alta':'normal'});
  if(a.kind==='boarding'&&['scheduled','confirmed'].includes(a.status)&&start>=date&&start<=lead('boarding'))output.push({id:a.id+':arrival',type:'boarding',target:'boarding',pet_id:a.pet_id,tutor_id:a.tutor_id,title:a.pet_name+' · entrada na hospedagem',detail:'Entrada prevista: '+a.start_at,priority:'normal'});
  if(a.kind==='boarding'&&a.status==='in_progress'&&end>=date&&end<=lead('boarding'))output.push({id:a.id+':departure',type:'boarding',target:'boarding',pet_id:a.pet_id,tutor_id:a.tutor_id,title:a.pet_name+' · saída da hospedagem',detail:'Saída prevista: '+a.end_at,priority:'normal'});
 }
 const required=settings.required_documents||[];
 if(required.length) {
  const pets=await rows(db,'SELECT id,name,tutor_id FROM pets WHERE archived=0'),files=await rows(db,"SELECT pet_id,document_type FROM files WHERE kind='document' AND removed_at IS NULL");
  for(const pet of pets)for(const name of required)if(!files.some(f=>f.pet_id===pet.id&&f.document_type?.toLowerCase()===name.toLowerCase()))output.push({id:pet.id+':'+name,type:'document',target:'pets',pet_id:pet.id,tutor_id:pet.tutor_id,title:pet.name+' · documento pendente',detail:name,priority:'alta'});
 }
 return output;
}

export async function dashboardMetrics(ctx,data) {
 if(!ctx.can(ctx.user,'operation'))return [];
 const date=ctx.localDate(),appointments=await ctx.rows(ctx.db,"SELECT a.id,a.start_at,a.end_at,a.actual_in,a.actual_out,a.status,s.kind FROM appointments a JOIN services s ON s.id=a.service_id WHERE (date(a.start_at,'-3 hours')<=? AND date(a.end_at,'-3 hours')>=?) OR a.status='in_progress' OR date(a.actual_out,'-3 hours')=?",[date,date,date]);
 const today=appointments.filter(a=>ctx.localDate(new Date(a.start_at))<=date&&ctx.localDate(new Date(a.end_at))>=date||a.status==='completed'&&a.actual_out&&ctx.localDate(new Date(a.actual_out))===date),live=appointments.filter(a=>a.status==='in_progress');
 const metric=(key,label,value,target,status='')=>({key,label,value,target,status});
 data.live_counts=Object.fromEntries(['daycare','boarding','grooming'].map(kind=>[kind,live.filter(a=>a.kind===kind).length]));
 const output=[metric('expected','Pets esperados',today.filter(a=>['scheduled','confirmed'].includes(a.status)).length,'appointments'),metric('daycare','Presentes na creche',live.filter(a=>a.kind==='daycare').length,'daycare','in_progress'),metric('boarding','Hospedados agora',live.filter(a=>a.kind==='boarding').length,'boarding','in_progress'),metric('grooming','Banhos e tosas agendados',today.filter(a=>a.kind==='grooming'&&!['cancelled','no_show','waitlist'].includes(a.status)).length,'grooming'),metric('running','Em atendimento',live.length,'appointments','in_progress'),metric('completed','Concluídos hoje',today.filter(a=>a.status==='completed'&&a.actual_out&&ctx.localDate(new Date(a.actual_out))===date).length,'appointments','completed'),metric('arrivals','Entradas de hospedagem',today.filter(a=>a.kind==='boarding'&&ctx.localDate(new Date(a.start_at))===date).length,'boarding'),metric('departures','Saídas de hospedagem',today.filter(a=>a.kind==='boarding'&&ctx.localDate(new Date(a.end_at))===date).length,'boarding'),metric('waitlist','Lista de espera',today.filter(a=>a.status==='waitlist').length,'appointments','waitlist')];
 for(const [type,label,target] of [['health','Pendências sanitárias','health'],['document','Documentos pendentes','pets'],['package','Pacotes com alerta','packages'],['inventory','Alertas de estoque','products'],['task','Tarefas atrasadas','tasks']])if(ctx.can(ctx.user,type==='inventory'?'inventory':type==='health'||type==='document'?'health':'operation'))output.push(metric(type,label,data.alerts.filter(a=>a.type===type).length,target));
 if(ctx.can(ctx.user,'finance'))output.push(metric('finance','Pagamentos pendentes',(await ctx.one(ctx.db,"SELECT COUNT(*) n FROM invoices i WHERE i.kind='receivable' AND i.amount_cents>COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0)")).n,'finance'));
 for(const kind of ['daycare','boarding','grooming'])output.push(metric('free-'+kind,'Vagas agora · '+({daycare:'Creche',boarding:'Hospedagem',grooming:'Banho e tosa'}[kind]),Math.max(0,(ctx.settings.capacities?.[kind]||0)-live.filter(a=>a.kind===kind).length),kind));
 return output;
}
