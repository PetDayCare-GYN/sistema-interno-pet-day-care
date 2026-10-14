import {createPet} from './photo-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,call,ok,book,finish,times,configureStaff,purchase,sale,owner} from './fixtures.mjs';

test('Reagendamento preserva identidade; promoção conflitante mantém a espera',async()=>{
 const f=await fixture();const first=await book(f),waiting=await book(f,{waitlist:true});
 assert.equal((await call(f.env,'appointments/'+waiting.id,{action:'promote',reason:'Vaga conferida'},'PATCH')).status,409);
 assert.equal(f.env.DB.sqlite.prepare('SELECT status FROM appointments WHERE id=?').get(waiting.id).status,'waitlist');
 await ok(f.env,'appointments/'+first.id,{action:'reschedule',reason:'Novo dia solicitado',...times(2)},'PATCH');
 const key=crypto.randomUUID(),body={action:'promote',reason:'Vaga conferida'};
 const a=await ok(f.env,'appointments/'+waiting.id,body,'PATCH',owner,{'Idempotency-Key':key});
 const b=await ok(f.env,'appointments/'+waiting.id,body,'PATCH',owner,{'Idempotency-Key':key});
 assert.equal(a.id,b.id);assert(b.repeated);assert.equal(a.id,waiting.id);
 assert.equal(f.env.DB.sqlite.prepare('SELECT COUNT(*) n FROM appointments').get().n,2);f.env.DB.close();
});
test('Falha no reagendamento preserva o horário e os vínculos anteriores',async()=>{
 const f=await fixture(),a=await book(f);const old=f.env.DB.sqlite.prepare('SELECT * FROM appointments WHERE id=?').get(a.id);
 const other=await createPet(f.env,owner,{name:'Outro pet',tutor_id:f.tutor.id,species:'Cão',size:'Médio'});await book(f,{pet_id:other.id,...times(2)});
 assert.equal((await call(f.env,'appointments/'+a.id,{action:'reschedule',reason:'Alteração de teste',...times(2)},'PATCH')).status,409);
 assert.deepEqual(f.env.DB.sqlite.prepare('SELECT * FROM appointments WHERE id=?').get(a.id),old);f.env.DB.close();
});
test('A capacidade específica do serviço é aplicada além da capacidade global',async()=>{
 const f=await fixture();await ok(f.env,'records/services/'+f.service.id,{name:'Banho',kind:'grooming',price_cents:8000,duration_minutes:60,capacity:1,active:true},'PATCH');await book(f);
 const other=await createPet(f.env,owner,{name:'Outro',tutor_id:f.tutor.id,species:'Cão',size:'Pequeno'}),staff=await ok(f.env,'users',{name:'Outra profissional',email:'other@example.test',role:'operation',active:true,permissions:{}});
 const r=await call(f.env,'appointments',{pet_id:other.id,service_id:f.service.id,user_id:staff.id,extras:[],...times()});assert.equal(r.status,409);assert.match(r.data.error,/Capacidade do serviço/);f.env.DB.close();
});
test('Comissão por recebimento aguarda quitação e conserva a regra original',async()=>{
 const f=await fixture();await configureStaff(f,{commission_kind:'percent',commission_value:1000,commission_services:[f.service.id],commission_condition:'paid',commission_period:'monthly'});
 const a=await book(f);await finish(f,a);const sql=f.env.DB.sqlite;
 assert.equal(sql.prepare('SELECT COUNT(*) n FROM commissions').get().n,0);
 await ok(f.env,'payments',{invoice_id:a.id,amount_cents:4000,method:'PIX'});assert.equal(sql.prepare('SELECT COUNT(*) n FROM commissions').get().n,0);
 await configureStaff(f,{commission_kind:'percent',commission_value:2000,commission_services:[f.service.id],commission_condition:'paid'});
 await ok(f.env,'payments',{invoice_id:a.id,amount_cents:4000,method:'PIX'});
 assert.equal(sql.prepare('SELECT amount_cents FROM commissions').get().amount_cents,800);
 assert.equal(JSON.parse(sql.prepare('SELECT rule FROM commissions').get().rule).value,1000);f.env.DB.close();
});
test('Serviços realizados reconciliam a cobrança e conservam os serviços solicitados',async()=>{
 const f=await fixture(),a=await book(f,{extras:[f.extra.id]});await finish(f,a,{performed_services:[],exit_notes:'Unhas não realizadas a pedido da tutora'});
 const saved=f.env.DB.sqlite.prepare('SELECT * FROM appointments WHERE id=?').get(a.id);
 assert.equal(saved.quote_cents,8000);assert.equal(JSON.parse(saved.extras).length,1);assert.deepEqual(JSON.parse(saved.performed_services),[]);
 assert.equal(saved.coat_condition,'Sem nós');assert.match(saved.exit_notes,/não realizadas/);assert.equal(f.env.DB.sqlite.prepare('SELECT amount_cents FROM invoices WHERE id=?').get(a.id).amount_cents,8000);f.env.DB.close();
});
test('Inventário físico registra diferença e ajusta estoque sem lançamento financeiro duplicado',async()=>{
 const f=await fixture();await purchase(f,3);const n=f.env.DB.sqlite.prepare('SELECT COUNT(*) n FROM invoices').get().n;
 await ok(f.env,'inventory-counts',{product_id:f.product.id,counted:5,reason:'Conferência física local'});
 assert.equal(f.env.DB.sqlite.prepare('SELECT stock FROM products WHERE id=?').get(f.product.id).stock,5);
 assert.deepEqual({...f.env.DB.sqlite.prepare('SELECT expected,counted FROM inventory_counts').get()},{expected:3,counted:5});
 assert.equal(f.env.DB.sqlite.prepare('SELECT COUNT(*) n FROM invoices').get().n,n);f.env.DB.close();
});
test('Devolução integral cancela o saldo, devolve estoque e gera reembolso pendente',async()=>{
 const f=await fixture();await purchase(f,3);const a=await sale(f,1,{discount_cents:100});await ok(f.env,'payments',{invoice_id:a.id,amount_cents:1000,method:'PIX'});
 const key=crypto.randomUUID(),body={reason:'Produto devolvido pela tutora',confirmation:'ESTORNAR',restock:true};
 const first=await ok(f.env,'order-returns/'+a.id,body,'POST',owner,{'Idempotency-Key':key});const again=await ok(f.env,'order-returns/'+a.id,body,'POST',owner,{'Idempotency-Key':key});assert.equal(first.id,again.id);
 const sql=f.env.DB.sqlite;assert.equal(sql.prepare('SELECT stock FROM products').get().stock,3);assert.equal(sql.prepare('SELECT status FROM orders WHERE id=?').get(a.id).status,'reversed');
 assert.equal(sql.prepare('SELECT amount_cents FROM invoices WHERE id=?').get(a.id).amount_cents,1000);
 assert.equal(sql.prepare("SELECT amount_cents FROM invoices WHERE source_type='return_sale'").get().amount_cents,1000);
 assert.equal(sql.prepare('SELECT SUM(amount_cents) n FROM payments').get().n,1000);assert.equal(sql.prepare('SELECT COUNT(*) n FROM order_returns').get().n,1);f.env.DB.close();
});
test('Devolver uma compra já consumida falha sem alterar estoque nem financeiro',async()=>{
 const f=await fixture(),p=await purchase(f,1);await sale(f,1);
 assert.equal((await call(f.env,'order-returns/'+p.id,{reason:'Devolução ao fornecedor',confirmation:'ESTORNAR'})).status,409);
 assert.equal(f.env.DB.sqlite.prepare('SELECT COUNT(*) n FROM order_returns').get().n,0);assert.equal(f.env.DB.sqlite.prepare('SELECT status FROM orders WHERE id=?').get(p.id).status,'posted');assert.equal(f.env.DB.sqlite.prepare('SELECT stock FROM products').get().stock,0);f.env.DB.close();
});
test('Remuneração e bônus geram contas vinculadas; períodos sobrepostos são rejeitados',async()=>{
 const f=await fixture();await configureStaff(f,{salary_cents:50000,bonus_kind:'fixed',bonus_value:10000,bonus_target:1});const a=await book(f);await finish(f,a);
 const base={user_id:f.staff.id,period_start:f.today,period_end:f.today};await ok(f.env,'payroll',{...base,kind:'salary'});await ok(f.env,'payroll',{...base,kind:'bonus'});
 assert.equal((await call(f.env,'payroll',{...base,kind:'salary'})).status,409);
 assert.equal(f.env.DB.sqlite.prepare('SELECT COUNT(*) n FROM payroll').get().n,2);assert.equal(f.env.DB.sqlite.prepare("SELECT SUM(amount_cents) n FROM invoices WHERE source_type='payroll'").get().n,60000);f.env.DB.close();
});
test('Fechamento usa recebimentos reais; reabertura auditada libera novos pagamentos',async()=>{
 const f=await fixture(),i=await ok(f.env,'invoices',{description:'Receita de teste',kind:'receivable',amount_cents:2000,due_date:f.today});await ok(f.env,'payments',{invoice_id:i.id,amount_cents:1000,method:'PIX'});
 const closure=await ok(f.env,'cash-closures',{period_start:f.today,period_end:f.today,opening_cents:100,counted_cents:1100});
 assert.equal((await call(f.env,'payments',{invoice_id:i.id,amount_cents:1000,method:'PIX'})).status,409);
 await ok(f.env,'cash-closures/'+closure.id,{reason:'Pagamento recebido após fechamento'},'PATCH');await ok(f.env,'payments',{invoice_id:i.id,amount_cents:1000,method:'PIX'});
 const flow=await ok(f.env,'cash-flow?from='+f.today+'&to='+f.today);assert.equal(flow.flow[0].received_cents,2000);f.env.DB.close();
});
test('Paginação alcança registros além da primeira página e mantém permissão no servidor',async()=>{
 const f=await fixture();for(let i=0;i<7;i++)await ok(f.env,'records/brands',{name:'Marca '+i});
 const ids=new Set();for(let offset=0;offset<7;offset+=2){const page=await ok(f.env,'list/brands?limit=2&offset='+offset);assert.equal(page.total,7);page.records.forEach(r=>ids.add(r.id));}assert.equal(ids.size,7);
 const worker={id:'operation-test',email:'operation-test@example.test'};await ok(f.env,'users',{name:'Monitora',email:worker.email,role:'operation',active:true,permissions:{}});
 assert.equal((await call(f.env,'list/cash_closures',undefined,'GET',worker)).status,403);assert.equal((await call(f.env,'cash-closures',{period_start:f.today,period_end:f.today,opening_cents:0,counted_cents:0},'POST',worker)).status,403);f.env.DB.close();
});
test('Horários, feriados e escalas são conferidos no agendamento',async()=>{
 const f=await fixture();await ok(f.env,'settings',{opening_hours:Array.from({length:7},()=>({enabled:true,open:'08:00',close:'17:00'})),require_shifts:true,closed_dates:[]});
 assert.equal((await call(f.env,'appointments',{pet_id:f.pet.id,service_id:f.service.id,user_id:f.staff.id,extras:[],...times()})).status,400);
 const shift=times();await ok(f.env,'records/shifts',{user_id:f.staff.id,start_at:shift.start_at,end_at:shift.end_at});await book(f);
 await ok(f.env,'settings',{closed_dates:[times(2).start_at.slice(0,10)]});
 assert.equal((await call(f.env,'appointments',{pet_id:f.pet.id,service_id:f.service.id,user_id:f.staff.id,extras:[],...times(2)})).status,400);f.env.DB.close();
});
test('Crédito em cancelamento exige regra explícita; espera cancelada não consome',async()=>{
 const f=await fixture();await ok(f.env,'records/services/'+f.service.id,{name:'Banho',kind:'grooming',price_cents:8000,duration_minutes:60,capacity:3,active:true,cancel_credit:true,cancellation_fee_cents:500},'PATCH');
 const template=await ok(f.env,'records/package_templates',{name:'Quatro banhos',service_id:f.service.id,credits:4,price_cents:28000,valid_days:90,active:true});const p=await ok(f.env,'packages',{pet_id:f.pet.id,template_id:template.id});
 const a=await book(f,{package_id:p.id});await ok(f.env,'appointments/'+a.id,{status:'cancelled',reason:'Cancelamento solicitado'},'PATCH');
 const waiting=await book(f,{package_id:p.id,waitlist:true});await ok(f.env,'appointments/'+waiting.id,{status:'cancelled',reason:'Saída da lista de espera'},'PATCH');
 assert.equal(f.env.DB.sqlite.prepare('SELECT balance FROM packages WHERE id=?').get(p.id).balance,3);assert.equal(f.env.DB.sqlite.prepare("SELECT amount_cents FROM invoices WHERE source_type='cancellation'").get().amount_cents,500);f.env.DB.close();
});
