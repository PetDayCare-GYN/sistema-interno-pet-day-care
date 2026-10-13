import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../lib/client-api.mjs';
test('Resposta perdida: repetir a operação usa a mesma chave; próximo registro usa outra',async()=>{
 const keys=[];let count=0;
 const api=createApi(async(path,options)=>{keys.push(options.headers['Idempotency-Key']);if(count++===0)throw Error('Network response lost after commit');return new Response(JSON.stringify({ok:true,id:'persisted-record'}),{headers:{'Content-Type':'application/json'}});});
 const body={invoice_id:'invoice-1',amount_cents:10000,method:'PIX'};
 await assert.rejects(()=>api('payments',body));await api('payments',body);await api('payments',body);
 assert.equal(keys[0],keys[1]);assert.notEqual(keys[1],keys[2]);
});
test('Cliques concorrentes para a mesma operação compartilham a chave',async()=>{
 const keys=[];let release;const gate=new Promise(resolve=>{release=resolve;});
 const api=createApi(async(path,options)=>{keys.push(options.headers['Idempotency-Key']);await gate;return new Response('{"ok":true}',{headers:{'Content-Type':'application/json'}});});
 const a=api('orders',{kind:'sale',items:[]}),b=api('orders',{kind:'sale',items:[]});release();await Promise.all([a,b]);assert.equal(keys[0],keys[1]);
});
