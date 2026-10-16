import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../lib/business.mjs';
import {authenticate} from '../lib/auth.mjs';
import {LocalDB,LocalBucket} from './adapter.mjs';

const json=(path,body)=>new Request('https://pet.example/api/'+path,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)});

async function setupOrg(){
 const env={DB:new LocalDB(),BUCKET:new LocalBucket()};env.DB.migrate();
 const res=await handleApi(json('setup',{name:'QA',user_name:'Dona',owner_email:'dona@pet.test',password:'senha-forte-123',technical_password:'Local-test-password-2026'}),env);
 assert.equal(res.status,200,await res.text());
 return env;
}

test('setup grava senha do dono e login devolve cookie de sessão', async () => {
 const env=await setupOrg();
 const ok=await handleApi(json('login',{email:'dona@pet.test',password:'senha-forte-123'}),env);
 assert.equal(ok.status,200);
 const cookie=ok.headers.get('set-cookie')||'';
 assert.match(cookie,/pet_session=[^;]+/);
 assert.match(cookie,/HttpOnly/);
});

test('login com senha errada é rejeitado (403)', async () => {
 const env=await setupOrg();
 const bad=await handleApi(json('login',{email:'dona@pet.test',password:'errada'}),env);
 assert.equal(bad.status,403);
});

test('login trava após 5 tentativas (429)', async () => {
 const env=await setupOrg();
 for(let i=0;i<5;i++)await handleApi(json('login',{email:'dona@pet.test',password:'errada'}),env);
 const blocked=await handleApi(json('login',{email:'dona@pet.test',password:'senha-forte-123'}),env);
 assert.equal(blocked.status,429);
});

test('middleware resolve identidade pelo cookie e ignora headers do cliente (anti-spoof)', async () => {
 const env=await setupOrg();
 const owner=env.DB.sqlite.prepare('SELECT * FROM users LIMIT 1').get();
 const login=await handleApi(json('login',{email:'dona@pet.test',password:'senha-forte-123'}),env);
 const token=(login.headers.get('set-cookie')||'').match(/pet_session=([^;]+)/)[1];
 const req=new Request('https://pet.example/api/state',{headers:{cookie:'pet_session='+token,'oai-authenticated-user-id':'spoof','oai-authenticated-user-email':'invasor@evil.test'}});
 const authed=await authenticate(req,env);
 assert.equal(authed.headers.get('oai-authenticated-user-email'),'dona@pet.test');
 assert.equal(authed.headers.get('oai-authenticated-user-id'),owner.id);
});

test('sem cookie, o middleware descarta a identidade enviada pelo cliente', async () => {
 const env=await setupOrg();
 const req=new Request('https://pet.example/api/state',{headers:{'oai-authenticated-user-email':'invasor@evil.test'}});
 const authed=await authenticate(req,env);
 assert.equal(authed.headers.get('oai-authenticated-user-email'),null);
});

test('sessão é renovada ao usar (janela de inatividade deslizante)', async () => {
 const env=await setupOrg();
 const login=await handleApi(json('login',{email:'dona@pet.test',password:'senha-forte-123'}),env);
 const token=(login.headers.get('set-cookie')||'').match(/pet_session=([^;]+)/)[1];
 // Simula 6 dias de inatividade: restam ~1 dia para expirar.
 const soon=new Date(Date.now()+86400000).toISOString();
 env.DB.sqlite.prepare('UPDATE sessions SET expires_at=?').run(soon);
 const req=new Request('https://pet.example/api/state',{headers:{cookie:'pet_session='+token}});
 const authed=await authenticate(req,env);
 assert.equal(authed.headers.get('oai-authenticated-user-email'),'dona@pet.test');
 const after=env.DB.sqlite.prepare('SELECT expires_at FROM sessions LIMIT 1').get().expires_at;
 // A requisição empurrou a expiração de volta para ~7 dias à frente.
 assert.ok(new Date(after).getTime()-Date.now()>6*86400000,'expires_at deveria ter sido renovado para ~7 dias');
});

test('sessão expira após 7 dias sem uso (cookie deixa de resolver)', async () => {
 const env=await setupOrg();
 const login=await handleApi(json('login',{email:'dona@pet.test',password:'senha-forte-123'}),env);
 const token=(login.headers.get('set-cookie')||'').match(/pet_session=([^;]+)/)[1];
 // Simula inatividade além da janela: expiração no passado.
 env.DB.sqlite.prepare('UPDATE sessions SET expires_at=?').run(new Date(Date.now()-1000).toISOString());
 const req=new Request('https://pet.example/api/state',{headers:{cookie:'pet_session='+token}});
 const authed=await authenticate(req,env);
 assert.equal(authed.headers.get('oai-authenticated-user-email'),null);
});

test('logout remove a sessão (cookie deixa de resolver)', async () => {
 const env=await setupOrg();
 const login=await handleApi(json('login',{email:'dona@pet.test',password:'senha-forte-123'}),env);
 const token=(login.headers.get('set-cookie')||'').match(/pet_session=([^;]+)/)[1];
 await handleApi(new Request('https://pet.example/api/logout',{method:'POST',headers:{cookie:'pet_session='+token,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:'{}'}),env);
 const req=new Request('https://pet.example/api/state',{headers:{cookie:'pet_session='+token}});
 const authed=await authenticate(req,env);
 assert.equal(authed.headers.get('oai-authenticated-user-email'),null);
});
