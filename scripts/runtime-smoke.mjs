// Integration smoke against LOCAL preview only. No production credentials/data.
const base='http://127.0.0.1:5173';
const page=await fetch(base+'/');if(page.status!==200)throw Error('Página local indisponível.');
const sign=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=sign.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('Autenticação local indisponível.');
async function request(path,body,method='POST'){const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':method,headers:{cookie,...(body===undefined?{}:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()})},body:body===undefined?undefined:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(`${path}: ${d.error}`);return d;}
const session=await request('session');if(!session.configured)await request('setup',{name:'Empresa de teste local',user_name:'Gestora de teste local',technical_password:'Local-test-password-2026'});
await request('settings',{capacities:{daycare:10,boarding:10,grooming:10,extra:0},boarding_duration:'planned',alert_days:15,require_health:false,payment_methods:['PIX'],backup_retention_days:30});
const suffix=Date.now(),tutor=await request('records/tutors',{name:'Tutora QA '+suffix,phone:String(suffix),email:`qa${suffix}@example.test`});
const pet=await request('records/pets',{name:'Pet QA',tutor_id:tutor.id,species:'Cão',size:'Pequeno'});
const service=await request('records/services',{name:'Banho QA '+suffix,kind:'grooming',price_cents:8000,duration_minutes:60,capacity:10,active:true,tolerance_minutes:0});
const template=await request('records/package_templates',{name:'4 banhos QA '+suffix,service_id:service.id,credits:4,price_cents:28000,valid_days:90,active:true});
const pack=await request('packages',{pet_id:pet.id,template_id:template.id});const state=await request('state');
const start=new Date(Date.now()+86400000),end=new Date(start.getTime()+3600000);
const appointment=await request('appointments',{pet_id:pet.id,service_id:service.id,user_id:state.user.id,package_id:pack.id,start_at:start.toISOString(),end_at:end.toISOString(),extras:[]});
await request('appointments/'+appointment.id,{status:'in_progress',person:'Tutora QA '+suffix},'PATCH');
await request('appointments/'+appointment.id,{status:'completed',person:'Tutora QA '+suffix},'PATCH');
const result=await request('pet/'+pet.id);if(result.packages[0].balance!==3)throw Error('Consumo real D1 incorreto.');
console.log(JSON.stringify({page:200,authentication:'local mock',database:'D1 local',packageBefore:4,packageAfter:3,history:result.appointments.length,productionDataTouched:false}));
