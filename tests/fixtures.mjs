import {createPet} from './photo-fixtures.mjs';
import assert from 'node:assert/strict';
import {handleApi,localDate} from '../lib/business.mjs';
import {LocalDB,LocalBucket} from './adapter.mjs';
export const owner={id:'acceptance-owner',email:'acceptance-owner@example.test'};
export async function call(env,path,body,method='POST',who=owner,extra={}) {
 const headers={'oai-authenticated-user-id':who?.id||'','oai-authenticated-user-email':who?.email||'',...(body===undefined?{}:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()}),...extra};
 const response=await handleApi(new Request('https://pet.example/api/'+path,{method:body===undefined?'GET':method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env);
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
 return {status:response.status,data,headers:response.headers};
}
export async function ok(...args){const r=await call(...args);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
export async function fixture() {
 const env={DB:new LocalDB(),BUCKET:new LocalBucket()};env.DB.migrate();
 await ok(env,'setup',{name:'Empresa de teste local',user_name:'Responsável de teste',technical_password:'Test-tech-access-2026'});
 await ok(env,'settings',{capacities:{daycare:3,boarding:3,grooming:3,extra:0},alert_days:15,require_health:false,required_vaccines:[],boarding_duration:'planned',payment_methods:['PIX','Dinheiro'],backup_retention_days:30});
 const tutor=await ok(env,'records/tutors',{name:'Tutora de teste',phone:'11999990101',email:'acceptance-tutor@example.test'});
 const pet=await createPet(env,owner,{name:'Luna',tutor_id:tutor.id,species:'Cão',size:'Pequeno'});
 const service=await ok(env,'records/services',{name:'Banho',kind:'grooming',price_cents:8000,duration_minutes:60,capacity:3,active:true});
 const extra=await ok(env,'records/services',{name:'Unhas',kind:'extra',price_cents:1000,duration_minutes:15,capacity:3,active:true});
 const staff=env.DB.sqlite.prepare('SELECT * FROM users').get();
 const category=await ok(env,'records/categories',{name:'Categoria local de teste'});
 const supplier=await ok(env,'records/suppliers',{name:'Fornecedor local de teste'});
 const product=await ok(env,'records/products',{name:'Produto de teste',category_id:category.id,supplier_id:supplier.id,sku:'AC-001',unit:'un',cost_cents:1000,price_cents:2500,min_stock:1,active:true});
 return {env,tutor,pet,service,extra,staff,category,supplier,product,today:localDate()};
}
export function times(offsetDays=1) {const start=new Date(Date.now()+offsetDays*86400000);start.setUTCHours(13,0,0,0);return {start_at:start.toISOString(),end_at:new Date(start.getTime()+75*60000).toISOString()};}
export const book=(f,changes={})=>ok(f.env,'appointments',{pet_id:f.pet.id,service_id:f.service.id,user_id:f.staff.id,extras:[],...times(),...changes});
export async function finish(f,a,fields={}) {await ok(f.env,'appointments/'+a.id,{status:'in_progress',person:'Tutora de teste',coat_condition:'Sem nós',entry_notes:'Entrada conferida'},'PATCH');return ok(f.env,'appointments/'+a.id,{status:'completed',person:'Tutora de teste',...fields},'PATCH');}
export const configureStaff=(f,fields)=>ok(f.env,'users/'+f.staff.id,{name:f.staff.name,email:f.staff.email,role:'management',active:true,permissions:{},commission_kind:'none',commission_value:0,commission_basis:'charged',commission_services:[],...fields},'PATCH');
export const purchase=(f,quantity)=>ok(f.env,'orders',{kind:'purchase',supplier_id:f.supplier.id,items:[{product_id:f.product.id,quantity,unit_cents:1000}]});
export const sale=(f,quantity,changes={})=>ok(f.env,'orders',{kind:'sale',tutor_id:f.tutor.id,pet_id:f.pet.id,items:[{product_id:f.product.id,quantity}],...changes});
