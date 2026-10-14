import {photoPng} from './photo-fixtures.mjs';
﻿import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handleApi} from '../lib/business.mjs';
import {LocalDB,LocalBucket} from './adapter.mjs';
test('Backup automático exige token de serviço e confirma gravação por leitura',async()=>{
 const token='test-only-backup-service-token';const env={DB:new LocalDB(),BUCKET:new LocalBucket(),BACKUP_SERVICE_HASH:createHash('sha256').update(token).digest('hex')};env.DB.migrate();
 const denied=await handleApi(new Request('https://pet.example/api/maintenance/backup',{method:'POST'}),env);assert.equal(denied.status,403);
 const headers={'X-Pet-Backup-Authorization':token};const response=await handleApi(new Request('https://pet.example/api/maintenance/backup',{method:'POST',headers}),env);assert.equal(response.status,200);const result=await response.json();
 const read=await handleApi(new Request('https://pet.example/api/maintenance/backup',{headers}),env);const persisted=await read.json();assert.equal(persisted.latest.id,result.id);assert.equal(env.DB.sqlite.prepare('SELECT actor_id FROM backups').get().actor_id,null);env.DB.close();
});
test('Upload rejeita conteúdo incompatível e aceita foto privada vinculada ao cadastro',async()=>{
 const env={DB:new LocalDB(),BUCKET:new LocalBucket()};env.DB.migrate();const identity={'oai-authenticated-user-id':'test-identity','oai-authenticated-user-email':'test@example.test'};
 const setup=await handleApi(new Request('https://pet.example/api/setup',{method:'POST',headers:{...identity,'Content-Type':'application/json'},body:JSON.stringify({name:'QA',user_name:'Pessoa QA',technical_password:'Test-only-password-2026'})}),env);assert.equal(setup.status,200);
 const user=env.DB.sqlite.prepare('SELECT id FROM users').get();env.DB.sqlite.prepare('INSERT INTO tutors(id,name,phone) VALUES(?,?,?)').run('tutor','Pessoa QA','11999888888');env.DB.sqlite.prepare('INSERT INTO pets(id,tutor_id,name,species,size) VALUES(?,?,?,?,?)').run('pet','tutor','Pet QA','Cão','Pequeno');
 async function upload(bytes,mime,key=crypto.randomUUID()){const body=new FormData();body.set('pet_id','pet');body.set('kind','photo');body.set('file',new File([bytes],'foto.png',{type:mime}));return handleApi(new Request('https://pet.example/api/files',{method:'POST',headers:{...identity,'Idempotency-Key':key},body}),env);}
 assert.equal((await upload('<script>invalid</script>','image/png')).status,400);
 const png=photoPng();const uploadKey=crypto.randomUUID();const response=await upload(png,'image/png',uploadKey);assert.equal(response.status,200);const result=await response.json();const retry=await upload(png,'image/png',uploadKey);assert.equal(retry.status,200);assert.equal((await retry.json()).id,result.id);assert.equal([...env.BUCKET.objects.keys()].filter(k=>k.startsWith('files/')).length,1);assert.equal([...env.BUCKET.objects.keys()].filter(k=>k.startsWith('archive/files/')).length,1);assert.equal(env.DB.sqlite.prepare('SELECT photo_id FROM pets WHERE id=?').get('pet').photo_id,result.id);
 const image=await handleApi(new Request('https://pet.example/api/files/'+result.id,{headers:identity}),env);assert.equal(image.status,200);assert.equal(image.headers.get('Content-Type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
 const denied=await handleApi(new Request('https://pet.example/api/files/'+result.id),env);assert.equal(denied.status,401);assert.equal(env.DB.sqlite.prepare('SELECT actor_id FROM files').get().actor_id,user.id);env.DB.close();
});

