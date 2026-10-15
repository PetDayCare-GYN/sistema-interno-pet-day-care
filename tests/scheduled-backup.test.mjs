import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi,runScheduledBackup} from '../lib/business.mjs';
import {LocalDB,LocalBucket} from './adapter.mjs';

function freshEnv(){const env={DB:new LocalDB(),BUCKET:new LocalBucket()};env.DB.migrate();return env;}

test('runScheduledBackup pula quando a empresa não está configurada', async () => {
 const env=freshEnv();
 const r=await runScheduledBackup(env);
 assert.equal(r.skipped,'nao-configurado');
});

test('runScheduledBackup pula quando falta binding', async () => {
 assert.equal((await runScheduledBackup({DB:null,BUCKET:null})).skipped,'bindings-indisponiveis');
});

test('runScheduledBackup completa um backup automático quando configurado', async () => {
 const env=freshEnv();
 await handleApi(new Request('https://pet.example/api/setup',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({name:'QA',user_name:'Dona',owner_email:'d@pet.test',password:'senha-forte-1',technical_password:'Tecnica-local-2026'})}),env);
 const r=await runScheduledBackup(env);
 assert.equal(r.status,'complete');
 const row=env.DB.sqlite.prepare("SELECT status,name FROM backups ORDER BY created_at DESC LIMIT 1").get();
 assert.equal(row.status,'complete');
 assert.match(row.name,/autom/i);
});
