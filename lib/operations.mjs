import {models} from './models.mjs';
import {validateAvailability} from './availability.mjs';

export const extraLists={brands:'inventory',financial_categories:'finance',shifts:'team',payroll:'team',order_returns:'inventory',inventory_counts:'inventory',package_adjustments:'operation',commission_candidates:'team',cash_closures:'finance'};
const ledgerLists={appointments:'operation',packages:'operation',credit_events:'operation',orders:'inventory',order_items:'inventory',stock_events:'inventory',invoices:'finance',payments:'finance',commissions:'finance',users:'team',audit:'technical',...extraLists};
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
export async function replayOperation(ctx) {
  if(['GET','HEAD'].includes(ctx.request.method))return null;
  const key=ctx.request.headers.get('idempotency-key');
  if(!key)return null;
  const record=await ctx.one(ctx.db,'SELECT * FROM request_keys WHERE id=?',[key]);
  if(!record)return null;
  const fingerprint=await ctx.digest(`${ctx.request.method}:${new URL(ctx.request.url).pathname}:${ctx.user.id}:${ctx.request.petFingerprint||''}`);
  ctx.need(record.actor_id===ctx.user.id&&record.fingerprint===fingerprint,'Identificador de operação já utilizado.',409);
  return ctx.json({ok:true,repeated:true,id:record.result_id});
}
export const period=(query,localDate,need)=>{
  const from=query.get('from')||localDate(new Date(Date.now()-30*86400000));
  const to=query.get('to')||localDate();
  need(datePattern.test(from)&&datePattern.test(to)&&to>=from&&!isNaN(new Date(from))&&!isNaN(new Date(to)),'Período inválido.');
  return {from,to,start:from+'T00:00:00-03:00',end:new Date(new Date(to+'T00:00:00-03:00').getTime()+86400000).toISOString()};
};
export async function financialFlow(ctx,from,to) {
  const {db,rows}=ctx;
  return rows(db,`SELECT date(p.created_at,'-3 hours') AS day,p.method,
    SUM(CASE WHEN i.kind='receivable' THEN p.amount_cents ELSE 0 END) AS received_cents,
    SUM(CASE WHEN i.kind='payable' THEN p.amount_cents ELSE 0 END) AS paid_cents,
    SUM(CASE WHEN i.kind='receivable' THEN p.amount_cents ELSE -p.amount_cents END) AS net_cents,COUNT(*) AS movements
    FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE date(p.created_at,'-3 hours') BETWEEN ? AND ?
    GROUP BY date(p.created_at,'-3 hours'),p.method ORDER BY day,p.method`,[from,to]);
}

export async function enrichState(ctx,data) {
  const {db,user,can,rows,stmt,hideMoney}=ctx;
  for(const [table,domain] of Object.entries(extraLists)) {
    if(!can(user,domain))continue;
    data.lists[table]=(await rows(db,`SELECT * FROM ${table} ORDER BY created_at DESC,id LIMIT 100`)).map(r=>hideMoney(r,user));
  }
  const names=Object.keys(data.lists).filter(t=>t!=='users');
  const totals=await db.batch(names.map(t=>stmt(db,`SELECT COUNT(*) AS total FROM ${t}${['pets','tutors'].includes(t)?' WHERE archived=0':''}`)));
  data.counts=Object.fromEntries(names.map((t,i)=>[t,totals[i].results[0].total]));
  data.limits.records=100;
  if(can(user,'finance')) {
    data.lists.invoices=await rows(db,'SELECT i.*,COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0) AS paid_cents FROM invoices i ORDER BY created_at DESC,id LIMIT 100');
    data.finance_totals=await ctx.one(db,`SELECT
      COALESCE((SELECT SUM(amount_cents) FROM invoices WHERE kind='receivable'),0) AS receivable_cents,
      COALESCE((SELECT SUM(amount_cents) FROM invoices WHERE kind='payable'),0) AS payable_cents,
      COALESCE((SELECT SUM(p.amount_cents) FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.kind='receivable'),0) AS received_cents,
      COALESCE((SELECT SUM(p.amount_cents) FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.kind='payable'),0) AS paid_cents`);
  }
  return data;
}

export async function handleOperations(ctx) {
  const {request,db,path,body,user,settings,need,can,permit,rows,one,stmt,insert,update,mutate,json,uid,now,localDate,hideMoney,stepUp,priceBoarding}=ctx;
  const query=request.method==='POST'&&['lookup','calendar'].includes(path[0])?new URLSearchParams(Object.entries(body).filter(([,v])=>v!=null).map(([k,v])=>[k,String(v)])):new URL(request.url).searchParams;
  if(path[0]==='appointment-files'&&request.method==='GET') {
    permit(user,'operation');need(await one(db,'SELECT id FROM appointments WHERE id=?',[path[1]]),'Atendimento não encontrado.',404);
    return json({records:(await rows(db,'SELECT id,name,mime,kind,health_id,created_at FROM files WHERE appointment_id=? AND removed_at IS NULL ORDER BY created_at',[path[1]])).filter(f=>['before','after','activity'].includes(f.kind)||can(user,f.health_id?'health':'registry'))});
  }
  if(path[0]==='calendar'&&(request.method==='GET'||request.method==='POST'&&path[1]==='search')) {
    permit(user,'operation');const {start,end}=period(query,localDate,need);
    need((new Date(end)-new Date(start))/86400000<=370,'Consulte até um ano de agenda por vez.');
    const conditions=['((a.start_at<? AND a.end_at>?) OR (a.actual_out>=? AND a.actual_out<?) OR (a.status=\'in_progress\' AND a.actual_in<?))'],args=[end,new Date(start).toISOString(),new Date(start).toISOString(),end,end];
    for(const [key,column] of [['kind','s.kind'],['status','a.status'],['user_id','a.user_id'],['service_id','a.service_id'],['pet_id','a.pet_id'],['tutor_id','p.tutor_id']]){const value=query.get(key);if(value){conditions.push(column+'=?');args.push(value);}}
    const q=query.get('q');if(q){need(new TextEncoder().encode(q).length<=40,'Busca muito longa.');conditions.push('(p.name LIKE ? OR t.name LIKE ? OR s.name LIKE ? OR u.name LIKE ?)');args.push(...Array(4).fill('%'+q.replace(/[%_]/g,'')+'%'));}
    const records=await rows(db,`SELECT a.*,p.name AS pet_name,p.photo_id,p.tutor_id,t.name AS tutor_name,s.name AS service_name,s.kind,u.name AS professional FROM appointments a JOIN pets p ON p.id=a.pet_id JOIN tutors t ON t.id=p.tutor_id JOIN services s ON s.id=a.service_id LEFT JOIN users u ON u.id=a.user_id WHERE ${conditions.join(' AND ')} ORDER BY a.start_at`,args);
    return json({records:records.map(r=>hideMoney(r,user)),capacities:settings.capacities});
  }
  if(path[0]==='invoices'&&path[1]&&request.method==='PATCH') {
    permit(user,'finance','edit');const bill=await one(db,'SELECT * FROM invoices WHERE id=?',[path[1]]);need(bill,'Lançamento não encontrado.',404);
    if(body.category_id)need(await one(db,'SELECT id FROM financial_categories WHERE id=? AND kind=?',[body.category_id,bill.kind==='receivable'?'income':'expense']),'Categoria financeira incompatível.');
    return json(await mutate(db,user,request,'invoices',bill.id,[update(db,'invoices',{category_id:body.category_id||null},bill.id)]));
  }
  if(path[0]==='list'&&request.method==='GET'||path[0]==='lookup'&&request.method==='POST') {
    const table=path[1],domain=models[table]?.permission||ledgerLists[table];
    need(domain,'Lista inválida.',404);permit(user,domain);
    if(domain==='technical')await stepUp(db,user,request);
    const limit=Number(query.get('limit')||100),offset=Number(query.get('offset')||0);
    need(Number.isSafeInteger(limit)&&limit>=1&&limit<=250&&Number.isSafeInteger(offset)&&offset>=0,'Página inválida.');
    let search=(query.get('q')||'').trim();
    while(new TextEncoder().encode(search).length>40)search=search.slice(0,-1);
    let conditions=['1=1'],args=[];
    if(['pets','tutors'].includes(table)&&query.get('archived')!=='1')conditions.push('archived=0');
    if(table==='files')conditions.push('removed_at IS NULL');
    if(search){const columns=Object.keys(models[table]?.fields||{}).filter(k=>['name','phone','email','sku','barcode','description','notes'].includes(k));need(columns.length,'A lista não possui busca por texto.');conditions.push('('+columns.map(k=>`${k} LIKE ? ESCAPE '\\'`).join(' OR ')+')');const pattern='%'+search.replace(/[\\%_]/g,'\\$&')+'%';args.push(...columns.map(()=>pattern));}
    const where=conditions.join(' AND ');
    const projection=table==='invoices'?'*,COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=invoices.id),0) AS paid_cents':'*';
    const [count,result]=await db.batch([stmt(db,`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`,args),stmt(db,`SELECT ${projection} FROM ${table} WHERE ${where} ORDER BY created_at DESC,id LIMIT ? OFFSET ?`,[...args,limit,offset])]);
    let records=result.results.map(r=>hideMoney(r,user));
    if(table==='users')records=records.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>k!=='identity_id')));
    if(table==='audit') {
      const staff=await rows(db,'SELECT id,name FROM users');
      records=records.map(r=>({...r,actor:staff.find(u=>u.id===r.actor_id)?.name||'Rotina automática'}));
    }
    return json({records,total:count.results[0].total,offset,limit,has_more:offset+records.length<count.results[0].total});
  }
  if(path[0]==='tutor'&&request.method==='GET') {
    permit(user,'registry');const tutor=await one(db,'SELECT * FROM tutors WHERE id=?',[path[1]]);need(tutor,'Tutor não encontrado.',404);
    const history={tutor,pets:await rows(db,'SELECT * FROM pets WHERE tutor_id=? ORDER BY name',[tutor.id])};
    if(can(user,'operation')) {
      history.appointments=(await rows(db,'SELECT a.* FROM appointments a JOIN pets p ON p.id=a.pet_id WHERE p.tutor_id=? ORDER BY a.start_at DESC',[tutor.id])).map(r=>hideMoney(r,user));
      history.packages=(await rows(db,'SELECT k.* FROM packages k JOIN pets p ON p.id=k.pet_id WHERE p.tutor_id=? ORDER BY k.created_at DESC',[tutor.id])).map(r=>hideMoney(r,user));
      history.communications=await rows(db,'SELECT c.*,u.name AS actor FROM communications c JOIN users u ON u.id=c.actor_id WHERE c.tutor_id=? ORDER BY c.created_at DESC',[tutor.id]);
    }
    if(can(user,'finance')) {
      history.invoices=await rows(db,'SELECT i.*,COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0) AS paid_cents FROM invoices i WHERE tutor_id=? ORDER BY created_at DESC',[tutor.id]);
      history.payments=await rows(db,'SELECT p.*,i.description,i.kind FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.tutor_id=? ORDER BY p.created_at DESC',[tutor.id]);
      history.orders=await rows(db,'SELECT * FROM orders WHERE tutor_id=? ORDER BY created_at DESC',[tutor.id]);
    }
    return json(history);
  }
  if(path[0]==='appointments'&&path[1]&&request.method==='PATCH'&&body.action) {
    permit(user,'operation','edit');const replay=await replayOperation(ctx);if(replay)return replay;const a=await one(db,'SELECT * FROM appointments WHERE id=?',[path[1]]);need(a,'Atendimento não encontrado.',404);
    need(['reschedule','promote','extend'].includes(body.action),'Ação inválida.');
    need(body.reason?.trim().length>=5,'Justifique a alteração.');
    const snapshot=JSON.parse(a.pricing),service=snapshot.service;
    if(body.action==='extend')need(a.status==='in_progress'&&service.kind==='boarding','A extensão exige hospedagem em andamento.');
    else need(['scheduled','confirmed','waitlist'].includes(a.status),'Somente reservas abertas podem ser reagendadas.');
    if(body.action==='promote')need(a.status==='waitlist','A reserva não está na espera.');
    const start=body.action==='extend'?a.start_at:(body.start_at||a.start_at),end=body.end_at||a.end_at;
    need(!isNaN(new Date(start))&&!isNaN(new Date(end))&&new Date(end)>new Date(start),'Período inválido.');
    const startAt=new Date(start).toISOString(),endAt=new Date(end).toISOString(),userId=body.user_id===undefined?a.user_id:body.user_id||null;
    if(userId)need(await one(db,'SELECT id FROM users WHERE id=? AND active=1',[userId]),'Profissional inválido.');
    if(service.kind==='grooming')need(userId&&(new Date(endAt)-new Date(startAt))/60000>=service.duration_minutes+JSON.parse(a.extras).reduce((s,e)=>s+e.duration_minutes,0),'Confira profissional e duração dos serviços.');
    if(service.kind==='daycare')need(localDate(new Date(startAt))===localDate(new Date(endAt)),'Creche deve terminar no mesmo dia.');
    await validateAvailability(ctx,service,startAt,endAt,userId);
    const base=service.kind==='boarding'?priceBoarding(snapshot,startAt,endAt,snapshot.size):a.base_cents;
    const fields={start_at:startAt,end_at:endAt,user_id:userId,base_cents:base,quote_cents:(a.package_id?0:base)+a.extras_cents-a.discount_cents,credit_units:service.kind==='boarding'?Math.ceil((new Date(endAt)-new Date(startAt))/86400000):1,actor_id:user.id};
    if(body.action==='promote')fields.status='scheduled';
    return json(await mutate(db,user,request,'appointments',a.id,[update(db,'appointments',fields,a.id)],`${body.action}: ${body.reason}`));
  }
  if(path[0]==='inventory-counts'&&request.method==='POST') {
    permit(user,'inventory','approve');const product=await one(db,'SELECT * FROM products WHERE id=?',[body.product_id]);need(product,'Produto inexistente.');
    const lot=body.lot_id?await one(db,'SELECT * FROM lots WHERE id=? AND product_id=?',[body.lot_id,product.id]):null;
    if(body.lot_id)need(lot,'Lote incompatível.');
    const expected=lot?lot.stock:product.stock-(await one(db,'SELECT COALESCE(SUM(stock),0) AS n FROM lots WHERE product_id=?',[product.id])).n;
    const counted=Number(body.counted);need(Number.isSafeInteger(counted)&&counted>=0&&body.reason?.trim().length>=5,'Informe quantidade física e justificativa.');
    const id=uid();return json(await mutate(db,user,request,'inventory_counts',id,[insert(db,'inventory_counts',{id,product_id:product.id,lot_id:lot?.id||null,expected,counted,reason:body.reason.trim(),actor_id:user.id})],body.reason));
  }
  if(path[0]==='package-adjustments'&&request.method==='POST') {
    permit(user,'operation','approve');permit(user,'finance','approve');
    const units=Number(body.units);need(Number.isSafeInteger(units)&&units!==0&&body.reason?.trim().length>=5,'Informe ajuste de créditos e justificativa.');
    const id=uid();return json(await mutate(db,user,request,'package_adjustments',id,[insert(db,'package_adjustments',{id,package_id:body.package_id,units,reason:body.reason.trim(),actor_id:user.id})],body.reason));
  }
  if(path[0]==='order-returns'&&path[1]) {
    permit(user,'inventory','approve');permit(user,'finance','approve');
    const replay=await replayOperation(ctx);if(replay)return replay;
    const order=await one(db,'SELECT * FROM orders WHERE id=?',[path[1]]);need(order,'Pedido não encontrado.',404);
    const invoice=await one(db,'SELECT i.*,COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0) AS paid_cents FROM invoices i WHERE source_type=? AND source_id=?',[order.kind,order.id]);
    if(request.method==='GET')return json({order,invoice,items:await rows(db,'SELECT i.*,p.name,l.name AS lot FROM order_items i JOIN products p ON p.id=i.product_id LEFT JOIN lots l ON l.id=i.lot_id WHERE i.order_id=?',[order.id]),return:await one(db,'SELECT * FROM order_returns WHERE order_id=?',[order.id])});
    need(request.method==='POST','Método inválido.',405);need(order.status==='posted','O pedido já foi devolvido ou ainda não foi postado.');
    need(body.reason?.trim().length>=5&&body.confirmation==='ESTORNAR','Justifique e confirme o estorno integral.');
    const id=uid(),statements=[insert(db,'order_returns',{id,order_id:order.id,original_invoice_cents:invoice.amount_cents,settled_cents:invoice.paid_cents,reason:body.reason.trim(),actor_id:user.id})];
    if(order.kind==='sale'&&body.restock===false)for(const item of await rows(db,'SELECT * FROM order_items WHERE order_id=?',[order.id]))statements.push(insert(db,'stock_events',{id:uid(),product_id:item.product_id,lot_id:item.lot_id,quantity:-item.quantity,reason:'Descarte após devolução: '+body.reason,kind:'loss',actor_id:user.id}));
    return json(await mutate(db,user,request,'order_returns',id,statements,body.reason));
  }
  if(path[0]==='payroll'&&request.method==='POST') {
    permit(user,'team','approve');permit(user,'finance','approve');const replay=await replayOperation(ctx);if(replay)return replay;const staff=await one(db,'SELECT * FROM users WHERE id=? AND active=1',[body.user_id]);need(staff,'Profissional inválido.');
    const from=body.period_start,to=body.period_end;need(datePattern.test(from||'')&&datePattern.test(to||'')&&to>=from&&to<=localDate(),'Informe um período encerrado válido.');
    need(['salary','bonus'].includes(body.kind),'Modalidade de remuneração inválida.');
    const completed=await rows(db,"SELECT * FROM appointments WHERE user_id=? AND status='completed' AND date(actual_out,'-3 hours') BETWEEN ? AND ?",[staff.id,from,to]);
    let amount=staff.salary_cents;const rule={kind:body.kind,period_start:from,period_end:to,salary_cents:staff.salary_cents};
    if(body.kind==='bonus') {
      need(staff.bonus_kind!=='none'&&staff.bonus_target>0&&completed.length>=staff.bonus_target,'A meta configurada para bonificação não foi atingida.');
      const base=completed.reduce((s,a)=>s+a.quote_cents,0);
      amount=staff.bonus_kind==='fixed'?staff.bonus_value:Math.round(base*staff.bonus_value/10000);
      Object.assign(rule,{bonus_kind:staff.bonus_kind,bonus_value:staff.bonus_value,target:staff.bonus_target,completed:completed.length,base_cents:base});
    }
    if(body.amount_cents!=null){amount=Number(body.amount_cents);need(body.reason?.length>=5,'Justifique o valor diferente da regra.');rule.override=true;}
    need(Number.isSafeInteger(amount)&&amount>0,'Não há valor positivo a apurar.');const id=uid();
    return json(await mutate(db,user,request,'payroll',id,[insert(db,'payroll',{id,user_id:staff.id,kind:body.kind,period_start:from,period_end:to,amount_cents:amount,rule:JSON.stringify(rule),actor_id:user.id})],body.reason));
  }
  if(path[0]==='cash-flow'&&request.method==='GET') {
    permit(user,'finance');const {from,to}=period(query,localDate,need);
    return json({from,to,flow:await financialFlow(ctx,from,to),closures:await rows(db,'SELECT c.*,u.name AS actor FROM cash_closures c JOIN users u ON u.id=c.actor_id ORDER BY c.period_end DESC'),balances:await rows(db,'SELECT i.*,i.amount_cents-COALESCE((SELECT SUM(amount_cents) FROM payments WHERE invoice_id=i.id),0) AS balance_cents FROM invoices i WHERE balance_cents>0 ORDER BY due_date')});
  }
  if(path[0]==='cash-closures'&&request.method==='POST') {
    permit(user,'finance','approve');const replay=await replayOperation(ctx);if(replay)return replay;const from=body.period_start,to=body.period_end;
    need(datePattern.test(from||'')&&datePattern.test(to||'')&&to>=from&&to<=localDate(),'Período de fechamento inválido.');
    const opening=Number(body.opening_cents),counted=Number(body.counted_cents);need(Number.isSafeInteger(opening)&&Number.isSafeInteger(counted),'Informe o saldo inicial e o saldo conferido.');
    const flow=await financialFlow(ctx,from,to),expected=opening+flow.reduce((s,r)=>s+r.net_cents,0);
    if(counted!==expected)need(body.reason?.trim().length>=5,'Justifique a diferença no fechamento.');
    const existing=await one(db,'SELECT * FROM cash_closures WHERE period_start=? AND period_end=?',[from,to]);need(!existing||existing.status==='reopened','Este período já está fechado.');
    const id=existing?.id||uid(),fields={period_start:from,period_end:to,opening_cents:opening,expected_cents:expected,counted_cents:counted,snapshot:JSON.stringify({flow,payments_count:flow.reduce((s,r)=>s+r.movements,0),calculated_at:now()}),status:'closed',reason:body.reason||null,actor_id:user.id};
    return json(await mutate(db,user,request,'cash_closures',id,[existing?update(db,'cash_closures',fields,id):insert(db,'cash_closures',{id,...fields})],body.reason));
  }
  if(path[0]==='cash-closures'&&path[1]&&request.method==='PATCH') {
    permit(user,'finance','approve');const replay=await replayOperation(ctx);if(replay)return replay;need(body.reason?.trim().length>=5,'Justifique a reabertura.');need(await one(db,"SELECT id FROM cash_closures WHERE id=? AND status='closed'",[path[1]]),'Fechamento inexistente ou já reaberto.');
    return json(await mutate(db,user,request,'cash_closures',path[1],[update(db,'cash_closures',{status:'reopened',reason:body.reason,actor_id:user.id},path[1])],body.reason));
  }
  if(path[0]==='alerts'&&request.method==='POST') {
    const alerts=await ctx.alerts(db,settings),alert=alerts.find(a=>a.type+':'+a.id===body.id);need(alert,'O alerta não está mais ativo. Atualize a página.');
    const domain=alert.type==='finance'?'finance':alert.type==='inventory'?'inventory':['health','document'].includes(alert.type)?'health':'operation';permit(user,domain,'edit');
    need(['normal','alta'].includes(body.priority)&&['pendente','concluído','adiado'].includes(body.status),'Situação ou prioridade inválida.');
    if(body.user_id)need(await one(db,'SELECT id FROM users WHERE id=? AND active=1',[body.user_id]),'Responsável inválido.');
    if(body.status==='adiado')need(datePattern.test(body.snooze_until||'')&&body.snooze_until>=localDate(),'Informe uma data futura para o lembrete.');
    const fields={fingerprint:await ctx.digest(alert.title+'|'+alert.detail),priority:body.priority,user_id:body.user_id||null,status:body.status,snooze_until:body.status==='adiado'?body.snooze_until:null,notes:String(body.notes||'').slice(0,10000),actor_id:user.id,updated_at:now()};
    const existing=await one(db,'SELECT id FROM alert_states WHERE id=?',[body.id]);
    return json(await mutate(db,user,request,'alert_states',body.id,[existing?update(db,'alert_states',fields,body.id):insert(db,'alert_states',{id:body.id,...fields})]));
  }
  return null;
}

export async function applyAlertStates(ctx,warnings) {
  const states=await ctx.rows(ctx.db,'SELECT * FROM alert_states');
  const output=[];
  for(const alert of warnings) {
    const saved=states.find(s=>s.id===alert.type+':'+alert.id&&s.fingerprint);
    const matches=saved&&saved.fingerprint===await ctx.digest(alert.title+'|'+alert.detail);
    if(matches) {
      Object.assign(alert,{priority:saved.priority,user_id:saved.user_id,status:saved.status,notes:saved.notes,snooze_until:saved.snooze_until});
      if(saved.status==='concluído'||saved.status==='adiado'&&saved.snooze_until>ctx.localDate())continue;
    } else alert.status='pendente';
    output.push(alert);
  }
  return output;
}

