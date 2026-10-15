import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,ok,call} from './fixtures.mjs';

const weekdayOf=iso=>new Date(iso.slice(0,10)+'T12:00:00Z').getUTCDay();

test('recorrência cria agendamentos só nos dias escolhidos, pula repetidos e cancela', async () => {
 const f=await fixture();
 const creche=await ok(f.env,'records/services',{name:'Creche',kind:'daycare',price_cents:5000,duration_minutes:600,capacity:3,active:true});
 const r=await ok(f.env,'recurrences',{pet_id:f.pet.id,service_id:creche.id,weekdays:[1,3],start_date:'2026-11-02',end_date:'2026-11-29'});
 assert.ok(r.created>0,'deveria criar datas');
 const appts=f.env.DB.sqlite.prepare("SELECT start_at,recurrence_id,credit_units,quote_cents FROM appointments WHERE recurrence_id=? ORDER BY start_at").all(r.recurrence_id);
 assert.equal(appts.length,r.created);
 for(const a of appts){assert.ok([1,3].includes(weekdayOf(a.start_at)),'dia inesperado '+a.start_at);assert.equal(a.credit_units,1);assert.equal(a.quote_cents,5000);}
 // Reexecutar com o mesmo período: todas as datas já ocupadas pelo pet → 400
 const again=await call(f.env,'recurrences',{pet_id:f.pet.id,service_id:creche.id,weekdays:[1,3],start_date:'2026-11-02',end_date:'2026-11-29'});
 assert.equal(again.status,400);
 // Cancelar a recorrência inteira
 const cancel=await ok(f.env,'recurrences/'+r.recurrence_id+'/cancel',{reason:'Tutor encerrou a programação'});
 assert.equal(cancel.cancelled,appts.length);
 const active=f.env.DB.sqlite.prepare("SELECT COUNT(*) n FROM appointments WHERE recurrence_id=? AND status='scheduled'").get(r.recurrence_id);
 assert.equal(active.n,0);
});

test('recorrência vinculada a pacote zera a cobrança e não consome crédito na criação', async () => {
 const f=await fixture();
 const creche=await ok(f.env,'records/services',{name:'Creche',kind:'daycare',price_cents:5000,duration_minutes:600,capacity:3,active:true});
 const tpl=await ok(f.env,'records/package_templates',{name:'Creche 10 dias',service_id:creche.id,credits:10,price_cents:40000,valid_days:180,active:true});
 const pack=await ok(f.env,'packages',{pet_id:f.pet.id,template_id:tpl.id});
 const r=await ok(f.env,'recurrences',{pet_id:f.pet.id,service_id:creche.id,weekdays:[2],start_date:'2026-11-03',end_date:'2026-11-24',package_id:pack.id});
 assert.ok(r.created>0);
 const appt=f.env.DB.sqlite.prepare("SELECT package_id,quote_cents FROM appointments WHERE recurrence_id=? LIMIT 1").get(r.recurrence_id);
 assert.equal(appt.package_id,pack.id);
 assert.equal(appt.quote_cents,0);
 // crédito NÃO consumido na criação (balance intacto)
 const balance=f.env.DB.sqlite.prepare("SELECT balance,credits FROM packages WHERE id=?").get(pack.id);
 assert.equal(balance.balance,balance.credits);
});

test('recorrência exige pelo menos um dia da semana', async () => {
 const f=await fixture();
 const creche=await ok(f.env,'records/services',{name:'Creche',kind:'daycare',price_cents:5000,duration_minutes:600,capacity:3,active:true});
 const r=await call(f.env,'recurrences',{pet_id:f.pet.id,service_id:creche.id,weekdays:[],start_date:'2026-11-02',end_date:'2026-11-29'});
 assert.equal(r.status,400);
});
