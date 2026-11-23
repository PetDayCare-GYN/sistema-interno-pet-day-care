import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,owner,call,ok,book,finish,times} from './fixtures.mjs';
import {createPet,photoPng} from './photo-fixtures.mjs';
const petRow=(f,id)=>f.env.DB.sqlite.prepare('SELECT * FROM pets WHERE id=?').get(id);

test('pets-browse abre em ordem alfabética, conta o total e filtra por espécie/porte',async()=>{
 const f=await fixture();// f.pet = 'Luna' (Cão, Pequeno)
 await createPet(f.env,owner,{name:'Zeca',tutor_id:f.tutor.id,species:'Cão',size:'Grande'},{photo:photoPng([30,60,90])});
 await createPet(f.env,owner,{name:'Amora',tutor_id:f.tutor.id,species:'Gato',size:'Pequeno'},{photo:photoPng([90,60,30])});
 const all=await ok(f.env,'pets-browse',{});
 assert.equal(all.total,3);
 assert.deepEqual(all.records.map(p=>p.name),['Amora','Luna','Zeca']);
 const byTutor=await ok(f.env,'pets-browse',{sort:'created'});
 assert.equal(byTutor.records.length,3);// ordenação alternativa responde
 const gatos=await ok(f.env,'pets-browse',{species:'Gato'});
 assert.deepEqual(gatos.records.map(p=>p.name),['Amora']);
 const pequenos=await ok(f.env,'pets-browse',{size:'Pequeno'});
 assert.deepEqual(pequenos.records.map(p=>p.name).sort(),['Amora','Luna']);
 const busca=await ok(f.env,'pets-browse',{q:'zec'});
 assert.deepEqual(busca.records.map(p=>p.name),['Zeca']);
 f.env.DB.close();
});

test('pets-browse grava sexo e marcadores de comportamento e filtra por eles',async()=>{
 const f=await fixture();
 const femea=await createPet(f.env,owner,{name:'Nina',tutor_id:f.tutor.id,species:'Cão',size:'Médio',sex:'Fêmea',behavior_tags:'reativo,não socializa'},{photo:photoPng([10,20,30])});
 const row=petRow(f,femea.id);
 assert.equal(row.sex,'Fêmea');
 assert.equal(row.behavior_tags,'reativo,não socializa');
 const porSexo=await ok(f.env,'pets-browse',{sex:'Fêmea'});
 assert.deepEqual(porSexo.records.map(p=>p.name),['Nina']);
 assert.equal(porSexo.records[0].behavior_tags,'reativo,não socializa');
 const porComportamento=await ok(f.env,'pets-browse',{behavior:'reativo'});
 assert.deepEqual(porComportamento.records.map(p=>p.name),['Nina']);
 // marcador fora do vocabulário é recusado
 assert.equal((await call(f.env,'records/pets/'+femea.id,{behavior_tags:'inexistente'},'PATCH')).status,400);
 f.env.DB.close();
});

test('pets-browse classifica a situação vacinal e conta vacinas vencidas',async()=>{
 const f=await fixture();// f.pet = Luna, sem vacina
 const vencido=times(-400).start_at.slice(0,10);// data passada
 await ok(f.env,'records/health',{pet_id:f.pet.id,kind:'vacina',name:'V10',applied_date:vencido,due_date:vencido,proof_status:'comprovado'});
 const browse=await ok(f.env,'pets-browse',{});
 const luna=browse.records.find(p=>p.id===f.pet.id);
 assert.equal(luna.vaccine_rank,0);// vencida
 assert.equal(browse.counts.vaccine_overdue,1);
 const vencidas=await ok(f.env,'pets-browse',{vaccine:'vencida'});
 assert.deepEqual(vencidas.records.map(p=>p.id),[f.pet.id]);
 const emDia=await ok(f.env,'pets-browse',{vaccine:'em_dia'});
 assert.equal(emDia.records.length,0);
 f.env.DB.close();
});

test('pets-browse deriva último atendimento, modalidade e pacote ativo',async()=>{
 const f=await fixture();
 const a=await book(f);await finish(f,a);
 const template=await ok(f.env,'records/package_templates',{name:'Quatro banhos',service_id:f.service.id,credits:4,price_cents:28000,valid_days:90,active:true});
 await ok(f.env,'packages',{pet_id:f.pet.id,template_id:template.id});
 const browse=await ok(f.env,'pets-browse',{});
 const luna=browse.records.find(p=>p.id===f.pet.id);
 assert(luna.last_appointment_at);
 assert.equal(luna.active_package,1);
 assert.match(String(luna.modalidades),/grooming/);
 const comPacote=await ok(f.env,'pets-browse',{package:'1'});
 assert.deepEqual(comPacote.records.map(p=>p.id),[f.pet.id]);
 const banho=await ok(f.env,'pets-browse',{modalidade:'grooming'});
 assert.deepEqual(banho.records.map(p=>p.id),[f.pet.id]);
 const hospedagem=await ok(f.env,'pets-browse',{modalidade:'boarding'});
 assert.equal(hospedagem.records.length,0);
 f.env.DB.close();
});
