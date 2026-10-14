import {identities} from './pet-identity.mjs';
import {period,financialFlow} from './operations.mjs';
import {reportPdf} from './report-pdf.mjs';
export const reportTitles={appointments:'Reservas, cancelamentos e faltas',occupancy:'Ocupação por dia e modalidade',frequency:'Frequência da creche',packages:'Utilização e saldo de pacotes',boarding:'Hospedagens e temporadas',grooming:'Banho e tosa',revenue_services:'Receitas gerenciais por serviço',revenue_products:'Receitas por produto',invoices:'Receitas, despesas e saldos',payments:'Recebimentos e pagamentos',delinquency:'Inadimplência atual',cash_flow:'Fluxo de caixa realizado',results:'Resultados estimados',commissions:'Comissões apuradas e pagas',commission_pending:'Comissões aguardando recebimento',recurring:'Clientes recorrentes e retorno',stock:'Posição atual do estoque',turnover:'Vendas e giro de produtos',movements:'Movimentações, perdas e devoluções',expiry:'Lotes e vencimentos atuais',health:'Vacinas e vermífugos pendentes',documents:'Documentos pendentes',incidents:'Histórico de ocorrências',payroll:'Remuneração e bonificações'};
const sum=(values,key)=>values.reduce((s,r)=>s+Number(r[key]||0),0);
const by=(values,key,seed,add)=>{
 const groups=new Map();for(const value of values){const id=key(value);if(!groups.has(id))groups.set(id,seed(value));add(groups.get(id),value);}return [...groups.values()];
};
function peak(values,start,end) {
 const points=[];for(const value of values){if(value.end<=start||value.start>=end)continue;points.push([Math.max(start,value.start),1],[Math.min(end,value.end),-1]);}
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);let current=0,max=0;for(const [,change] of points){current+=change;max=Math.max(max,current);}return max;
}
const parse=s=>JSON.parse(s||'{}');
export async function buildReport(ctx) {
 const {db,rows,user,can,need,localDate,settings}=ctx,query=new URL(ctx.request.url).searchParams;
 const {from,to,start,end}=period(query,localDate,need);
 const days=Math.round((new Date(to)-new Date(from))/86400000)+1;
 need(days<=366,'Consulte até 366 dias por relatório.');
 const clauses=['((a.start_at<? AND a.end_at>?) OR (a.actual_out>=? AND a.actual_out<?))'],args=[end,new Date(start).toISOString(),new Date(start).toISOString(),end];
 const filters={pet_id:query.get('pet_id'),tutor_id:query.get('tutor_id'),service_id:query.get('service_id'),user_id:query.get('user_id')};
 for(const [key,value] of Object.entries(filters))if(value){need(value.length<=100,'Filtro inválido.');clauses.push((key==='tutor_id'?'p.tutor_id':'a.'+key)+'=?');args.push(value);}
 const appointments=await rows(db,`SELECT a.*,p.name AS pet,p.photo_id,p.tutor_id,t.name AS tutor,s.name AS service,s.kind,u.name AS professional
 FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN tutors t ON t.id=p.tutor_id JOIN services s ON s.id=a.service_id LEFT JOIN users u ON u.id=a.user_id WHERE ${clauses.join(' AND ')} ORDER BY a.start_at`,args);
 const pets=await rows(db,'SELECT p.*,t.name AS tutor FROM pets p JOIN tutors t ON t.id=p.tutor_id WHERE p.archived=0');
 const matchesPet=p=>(!filters.pet_id||p.id===filters.pet_id)&&(!filters.tutor_id||p.tutor_id===filters.tutor_id)&&(!filters.service_id&&!filters.user_id||appointments.some(a=>a.pet_id===p.id));
 const petIds=new Set(pets.filter(matchesPet).map(p=>p.id));
 const packages=(await rows(db,'SELECT k.*,p.name AS pet,p.tutor_id,t.name AS tutor FROM packages k JOIN pets p ON p.id=k.pet_id JOIN tutors t ON t.id=p.tutor_id')).filter(k=>petIds.has(k.pet_id)&&(!filters.service_id||k.service_id===filters.service_id));
 const report={appointments:appointments.map(a=>({id:a.id,pet_id:a.pet_id,pet:a.pet,tutor:a.tutor,service:a.service,professional:a.professional,start_at:a.start_at,end_at:a.end_at,actual_in:a.actual_in,actual_out:a.actual_out,status:a.status,package_id:a.package_id,quote_cents:a.quote_cents})),occupancy:[],frequency:[],packages:[],boarding:[],grooming:[]};
 for(let i=0;i<days;i++) {
  const day=localDate(new Date(new Date(start).getTime()+i*86400000)),left=new Date(day+'T00:00:00-03:00').getTime(),right=left+86400000;
  for(const kind of ['daycare','boarding','grooming']) {
   const data=appointments.filter(a=>a.kind===kind&&!['cancelled','no_show','waitlist'].includes(a.status));
   const booked=peak(data.map(a=>({start:new Date(a.start_at).getTime(),end:new Date(a.end_at).getTime()})),left,right);
   const present=peak(data.filter(a=>a.actual_in).map(a=>({start:new Date(a.actual_in).getTime(),end:new Date(a.actual_out||ctx.now()).getTime()})),left,right);
   const capacity=settings.capacities?.[kind]||0;
   report.occupancy.push({day,kind,peak_booked:booked,peak_present:present,capacity,occupancy_percent:capacity?Math.round(present/capacity*100):null});
  }
 }
 const completed=appointments.filter(a=>a.status==='completed'&&a.actual_out>=new Date(start).toISOString()&&a.actual_out<end);
 report.frequency=by(completed.filter(a=>a.kind==='daycare'),a=>a.pet_id,a=>({pet_id:a.pet_id,pet:a.pet,tutor:a.tutor,visits:0,last_visit:null}), (g,a)=>{g.visits++;if(!g.last_visit||a.actual_out>g.last_visit)g.last_visit=a.actual_out;});
 const creditEvents=await rows(db,'SELECT * FROM credit_events ORDER BY created_at,id');
 const adjustments=await rows(db,'SELECT * FROM package_adjustments');
 report.packages=packages.map(k=>({id:k.id,pet_id:k.pet_id,pet:k.pet,tutor:k.tutor,name:k.name,credits:k.credits,used:sum(creditEvents.filter(e=>e.package_id===k.id),'units'),adjustments:sum(adjustments.filter(e=>e.package_id===k.id),'units'),balance:k.balance,expires_at:k.expires_at}));
 report.boarding=appointments.filter(a=>a.kind==='boarding').map(a=>({id:a.id,pet_id:a.pet_id,pet:a.pet,tutor:a.tutor,status:a.status,start_at:a.start_at,end_at:a.end_at,actual_in:a.actual_in,actual_out:a.actual_out,duration_hours:Math.round((new Date(a.actual_out||a.end_at)-new Date(a.actual_in||a.start_at))/3600000*100)/100,season_policy:parse(a.pricing).service?.boarding_policy,seasons:(parse(a.pricing).seasons||[]).filter(s=>s.size===parse(a.pricing).size&&s.start_date<=localDate(new Date(a.end_at))&&s.end_date>=localDate(new Date(a.start_at))).map(s=>s.name).join(', '),quote_cents:a.quote_cents}));
 report.grooming=appointments.filter(a=>a.kind==='grooming').map(a=>({id:a.id,pet_id:a.pet_id,pet:a.pet,tutor:a.tutor,professional:a.professional,status:a.status,start_at:a.start_at,actual_out:a.actual_out,requested:parse(a.extras).map(e=>e.name).join(', '),performed:a.performed_services?parse(a.performed_services).map(e=>e.name).join(', '):null,coat_condition:a.coat_condition,exit_notes:a.exit_notes,quote_cents:a.quote_cents}));
 report.recurring=by(completed,a=>a.tutor_id,a=>({tutor_id:a.tutor_id,tutor:a.tutor,visits:0,first_visit:null,last_visit:null,return_days:null}), (g,a)=>{g.visits++;if(!g.first_visit||a.actual_out<g.first_visit)g.first_visit=a.actual_out;if(!g.last_visit||a.actual_out>g.last_visit)g.last_visit=a.actual_out;}).map(g=>({...g,return_days:g.visits>1?Math.round((new Date(g.last_visit)-new Date(g.first_visit))/86400000/(g.visits-1)*10)/10:null}));
 if(can(user,'finance')) {
  const allInvoices=await rows(db,'SELECT i.*,c.name AS category,u.name AS payee,COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0) AS paid_cents FROM invoices i LEFT JOIN financial_categories c ON c.id=i.category_id LEFT JOIN users u ON u.id=i.party_user_id');
  const invoiceMatches=i=>{
   if(filters.tutor_id&&i.tutor_id!==filters.tutor_id)return false;
   if(filters.pet_id||filters.service_id){if(i.source_type==='appointment'||i.source_type==='cancellation')return appointments.some(a=>a.id===i.source_id);if(i.source_type==='package')return packages.some(k=>k.id===i.source_id);return false;}
   if(filters.user_id)return i.party_user_id===filters.user_id||appointments.some(a=>a.id===i.source_id&&a.user_id===filters.user_id);
   return true;
  };
  const invoices=allInvoices.filter(invoiceMatches);
  report.invoices=invoices.filter(i=>localDate(new Date(i.created_at))>=from&&localDate(new Date(i.created_at))<=to).map(i=>({...i,balance_cents:i.amount_cents-i.paid_cents}));
  const invoiceIds=new Set(invoices.map(i=>i.id));
  report.payments=(await rows(db,"SELECT p.*,i.kind,i.description,u.name AS actor FROM payments p JOIN invoices i ON i.id=p.invoice_id JOIN users u ON u.id=p.actor_id WHERE p.created_at>=? AND p.created_at<? ORDER BY p.created_at",[new Date(start).toISOString(),end])).filter(p=>invoiceIds.has(p.invoice_id));
  report.delinquency=invoices.filter(i=>i.kind==='receivable'&&i.due_date<localDate()&&i.amount_cents>i.paid_cents).map(i=>({id:i.id,tutor_id:i.tutor_id,description:i.description,due_date:i.due_date,amount_cents:i.amount_cents,paid_cents:i.paid_cents,balance_cents:i.amount_cents-i.paid_cents}));
  report.cash_flow=by(report.payments,p=>localDate(new Date(p.created_at))+'|'+p.method,p=>({day:localDate(new Date(p.created_at)),method:p.method,received_cents:0,paid_cents:0,net_cents:0}), (g,p)=>{if(p.kind==='receivable')g.received_cents+=p.amount_cents;else g.paid_cents+=p.amount_cents;g.net_cents=g.received_cents-g.paid_cents;});
  const commissions=(await rows(db,'SELECT c.*,u.name AS professional,i.amount_cents AS payable_cents,COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0) AS paid_cents FROM commissions c JOIN users u ON u.id=c.user_id LEFT JOIN invoices i ON i.source_type=\'commission\' AND i.source_id=c.id WHERE c.created_at>=? AND c.created_at<?',[new Date(start).toISOString(),end])).filter(c=>!filters.user_id||c.user_id===filters.user_id).filter(c=>!filters.pet_id&&!filters.service_id&&!filters.tutor_id||appointments.some(a=>a.id===c.source_id));
  report.commissions=commissions.map(c=>({...c,balance_cents:(c.payable_cents||0)-c.paid_cents}));
  report.commission_pending=(await rows(db,"SELECT c.*,u.name AS professional FROM commission_candidates c JOIN users u ON u.id=c.user_id WHERE c.reversed=0 AND NOT EXISTS(SELECT 1 FROM commissions WHERE id=c.id)")).filter(c=>(!filters.user_id||c.user_id===filters.user_id)&&(!filters.pet_id&&!filters.service_id&&!filters.tutor_id||appointments.some(a=>a.id===c.source_id)));
  report.payroll=(await rows(db,'SELECT p.*,u.name AS professional,COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=p.id),0) AS paid_cents FROM payroll p JOIN users u ON u.id=p.user_id WHERE p.period_start<=? AND p.period_end>=?',[to,from])).filter(p=>!filters.user_id||p.user_id===filters.user_id);
  const sales=(await rows(db,"SELECT o.*,i.id AS item_id,i.product_id,i.quantity,i.unit_cents,i.cost_cents,p.name AS product,p.sku FROM orders o JOIN order_items i ON i.order_id=o.id JOIN products p ON p.id=i.product_id WHERE o.kind='sale' AND o.status='posted' AND o.created_at>=? AND o.created_at<?",[new Date(start).toISOString(),end])).filter(o=>(!filters.tutor_id||o.tutor_id===filters.tutor_id)&&(!filters.pet_id||o.pet_id===filters.pet_id)&&(!filters.user_id||o.user_id===filters.user_id)&&!filters.service_id);
  const totals=new Map();for(const sale of sales)totals.set(sale.id,(totals.get(sale.id)||0)+sale.quantity*sale.unit_cents);
  const allocated=new Map();for(const sale of sales){const data=sales.filter(s=>s.id===sale.id),index=data.findIndex(s=>s.item_id===sale.item_id);let net;if(index===data.length-1)net=sale.total_cents-data.slice(0,-1).reduce((s,r)=>s+Math.floor(r.quantity*r.unit_cents*sale.total_cents/totals.get(sale.id)),0);else net=Math.floor(sale.quantity*sale.unit_cents*sale.total_cents/totals.get(sale.id));allocated.set(sale.item_id,net);}
  report.revenue_products=by(sales,s=>s.product_id,s=>({product_id:s.product_id,product:s.product,sku:s.sku,quantity:0,revenue_cents:0,cost_cents:0,unknown_cost_units:0}), (g,s)=>{g.quantity+=s.quantity;g.revenue_cents+=allocated.get(s.item_id)||0;if(s.cost_cents==null)g.unknown_cost_units+=s.quantity;else g.cost_cents+=s.cost_cents*s.quantity;});
  const serviceRevenue=completed.map(a=>({...a,revenue_cents:a.quote_cents}));
  if(settings.package_accounting==='consumption') {
   const recognized=new Map();for(const event of creditEvents){const k=packages.find(k=>k.id===event.package_id);if(!k)continue;const previous=recognized.get(k.id)||0,used=Math.min(k.credits,previous+event.units);recognized.set(k.id,used);const increment=Math.round(k.price_cents*used/k.credits)-Math.round(k.price_cents*previous/k.credits);if(event.created_at>=new Date(start).toISOString()&&event.created_at<end){const found=serviceRevenue.find(a=>a.id===event.appointment_id);if(found)found.revenue_cents+=increment;else {const a=appointments.find(a=>a.id===event.appointment_id);if(a)serviceRevenue.push({...a,revenue_cents:increment+(a.status==='completed'?a.quote_cents:0)});}}}
  }
  report.revenue_services=by(serviceRevenue,a=>a.service_id,a=>({service_id:a.service_id,service:a.service,kind:a.kind,attendances:0,revenue_cents:0}), (g,a)=>{g.attendances+=a.status==='completed'?1:0;g.revenue_cents+=a.revenue_cents;});
  const packageSales=settings.package_accounting==='sale'?sum(report.invoices.filter(i=>i.source_type==='package'),'amount_cents'):0;
  const revenue=sum(report.revenue_services,'revenue_cents')+sum(report.revenue_products,'revenue_cents')+packageSales+sum(report.invoices.filter(i=>i.kind==='receivable'&&['manual','cancellation'].includes(i.source_type)),'amount_cents');
  const expense=sum(report.invoices.filter(i=>i.kind==='payable'&&['manual','payroll'].includes(i.source_type)),'amount_cents')+sum(commissions.filter(c=>!c.reversed),'amount_cents');
  const cost=sum(report.revenue_products,'cost_cents'),unknown=sum(report.revenue_products,'unknown_cost_units'),needsModel=!settings.package_accounting&&packages.length>0;
  report.results=[{managerial_model:settings.package_accounting||null,revenue_cents:needsModel?null:revenue,received_cents:sum(report.payments.filter(p=>p.kind==='receivable'),'amount_cents'),paid_cents:sum(report.payments.filter(p=>p.kind==='payable'),'amount_cents'),expense_cents:expense,cost_cents:cost,unknown_cost_units:unknown,estimated_profit_cents:unknown||needsModel?null:revenue-expense-cost,status:needsModel?'Defina a contabilização gerencial dos pacotes':unknown?'Há custos históricos não registrados':'Estimativa com custos e despesas registrados'}];
 }
 if(can(user,'inventory')) {
  report.stock=await rows(db,'SELECT id,name,sku,stock,min_stock,unit,cost_cents,stock*cost_cents AS stock_value_cents FROM products');
  report.expiry=await rows(db,'SELECT l.id,p.name AS product,l.name AS lot,l.stock,l.expires_date FROM lots l JOIN products p ON p.id=l.product_id WHERE l.stock>0 AND l.expires_date IS NOT NULL ORDER BY l.expires_date');
  report.movements=await rows(db,'SELECT e.*,p.name AS product,l.name AS lot,u.name AS actor FROM stock_events e JOIN products p ON p.id=e.product_id LEFT JOIN lots l ON l.id=e.lot_id JOIN users u ON u.id=e.actor_id WHERE e.created_at>=? AND e.created_at<? ORDER BY e.created_at',[new Date(start).toISOString(),end]);
  report.turnover=await rows(db,"SELECT p.id,p.name AS product,p.sku,p.stock,COALESCE(SUM(CASE WHEN o.status='posted' AND o.created_at>=? AND o.created_at<? THEN i.quantity ELSE 0 END),0) AS sold_units,MAX(CASE WHEN o.status='posted' THEN o.created_at END) AS last_sale FROM products p LEFT JOIN order_items i ON i.product_id=p.id LEFT JOIN orders o ON o.id=i.order_id AND o.kind='sale' GROUP BY p.id ORDER BY sold_units DESC",[new Date(start).toISOString(),end]);
 }
 if(can(user,'health')) {
  const health=await rows(db,'SELECT h.*,p.name AS pet,p.tutor_id,t.name AS tutor FROM health h JOIN pets p ON p.id=h.pet_id JOIN tutors t ON t.id=p.tutor_id WHERE p.archived=0 AND NOT EXISTS(SELECT 1 FROM health n WHERE n.pet_id=h.pet_id AND n.kind=h.kind AND lower(n.name)=lower(h.name) AND (n.applied_date>h.applied_date OR (n.applied_date=h.applied_date AND n.created_at>h.created_at)))');
  report.health=health.filter(h=>petIds.has(h.pet_id)&&(h.due_date<=localDate()||h.proof_status==='pendente')).map(h=>({id:h.id,pet_id:h.pet_id,pet:h.pet,tutor:h.tutor,kind:h.kind,name:h.name,due_date:h.due_date,proof_status:h.proof_status}));
  const docs=await rows(db,"SELECT pet_id,document_type FROM files WHERE kind='document' AND removed_at IS NULL");
  const required=settings.required_documents||[];
  report.documents=pets.filter(p=>petIds.has(p.id)).flatMap(p=>required.length?required.filter(name=>!docs.some(d=>d.pet_id===p.id&&d.document_type?.toLowerCase()===name.toLowerCase())).map(name=>({pet_id:p.id,pet:p.name,tutor:p.tutor,document_type:name,status:'Documento exigido pendente'})):!docs.some(d=>d.pet_id===p.id)?[{pet_id:p.id,pet:p.name,tutor:p.tutor,status:'Nenhum documento cadastrado'}]:[]);
 }
 if(can(user,'operation'))report.incidents=(await rows(db,"SELECT a.*,p.name AS pet,t.name AS tutor,u.name AS actor FROM activities a JOIN pets p ON p.id=a.pet_id JOIN tutors t ON t.id=p.tutor_id JOIN users u ON u.id=a.actor_id WHERE a.kind='ocorrência' AND a.created_at>=? AND a.created_at<? ORDER BY a.created_at",[new Date(start).toISOString(),end])).filter(a=>petIds.has(a.pet_id)&&(!filters.user_id||a.actor_id===filters.user_id));
 const photos=new Map((await identities(ctx,Object.values(report).flatMap(records=>records.map(r=>r.pet_id).filter(Boolean)))).map(p=>[p.id,p]));for(const key of Object.keys(report))report[key]=report[key].map(row=>row.pet_id?{...row,photo_id:photos.get(row.pet_id)?.photo_id||null,pet_identity:photos.get(row.pet_id)||null}:row);
 if(!can(user,'finance'))for(const key of Object.keys(report))report[key]=report[key].map(r=>ctx.hideMoney(r,user));
 return {report,meta:{from,to,as_of:ctx.now(),titles:reportTitles,filters,positions_are_current:['stock','expiry','health','documents','delinquency','commission_pending']}};
}

export async function handleReports(ctx) {
 if(ctx.path[0]!=='report'||ctx.request.method!=='GET')return null;
 ctx.permit(ctx.user,'reports','read');const {report,meta}=await buildReport(ctx),query=new URL(ctx.request.url).searchParams;
 const key=query.get('csv')||query.get('pdf');
 if(key) {
  ctx.permit(ctx.user,'reports','export');ctx.need(Array.isArray(report[key]),'Relatório inválido.');
  const records=report[key],columns=Object.keys(records[0]||{resultado:''}).filter(key=>key!=='pet_identity');
  await ctx.insert(ctx.db,'audit',{id:ctx.uid(),actor_id:ctx.user.id,action:query.has('pdf')?'export_pdf':'export_csv',entity:'reports',record_id:key,reason:meta.from+' a '+meta.to}).run();
  if(query.has('pdf')) {
   ctx.need(records.length<=2000,'O PDF suporta até 2.000 linhas por relatório. Reduza o período ou utilize CSV.',413);
   const bytes=await reportPdf(ctx,reportTitles[key],records,[...(records.some(r=>r.pet_id)?['pet_identity']:[]),...columns.filter(k=>k!=='photo_id')],meta);
   return new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${key}.pdf"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  const escape=value=>'"'+(typeof value==='string'?value.replace(/^[=+@\-]/,"'$&"):String(value??'')).replace(/"/g,'""')+'"';
  return new Response('\uFEFF'+[columns,...records.map(row=>columns.map(k=>row[k]))].map(row=>row.map(escape).join(';')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${key}.csv"`,'Cache-Control':'no-store'}});
 }
 return ctx.json({...report,_meta:meta});
}
