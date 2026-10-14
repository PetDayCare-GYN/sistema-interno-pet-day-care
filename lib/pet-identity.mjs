import {sha256,crc32} from './zip.mjs';
import {replayOperation} from './operations.mjs';
const maxPhotoBytes=5*1024*1024;
export function validatePetPhoto(file,bytes,need) {
 need(file&&file.size>0&&file.size<=maxPhotoBytes,'A foto deve ter até 5 MB.');
 let mime=null;
 if(bytes.length>=33&&bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10') {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=8,header=false,data=false,end=false;
  while(offset+12<=bytes.length){const size=view.getUint32(offset),type=new TextDecoder().decode(bytes.slice(offset+4,offset+8));need(size<=bytes.length-offset-12,'A imagem PNG está incompleta.');need(crc32(bytes.slice(offset+4,offset+8+size))===view.getUint32(offset+8+size),'A imagem PNG está corrompida.');if(type==='IHDR'){need(!header&&size===13&&offset===8,'A imagem PNG é inválida.');const width=view.getUint32(offset+8),height=view.getUint32(offset+12);need(width>0&&height>0&&width*height<=40000000,'A resolução da foto excede o limite de 40 megapixels.');header=true;}if(type==='IDAT')data=true;if(type==='IEND'){need(size===0&&offset+12===bytes.length,'A imagem PNG é inválida.');end=true;break;}offset+=size+12;}
  need(header&&data&&end,'A imagem PNG está incompleta.');mime='image/png';
 }
 if(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217){let offset=2,frame=false,scan=false;while(offset+3<bytes.length){need(bytes[offset]===255,'A imagem JPEG é inválida.');while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===218){scan=true;break;}if(marker===217)break;if(marker===1||marker>=208&&marker<=215)continue;const size=(bytes[offset]<<8)|bytes[offset+1];need(size>=2&&offset+size<=bytes.length,'A imagem JPEG está incompleta.');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){need(size>=8,'A imagem JPEG é inválida.');const height=(bytes[offset+3]<<8)|bytes[offset+4],width=(bytes[offset+5]<<8)|bytes[offset+6];need(width>0&&height>0&&width*height<=40000000,'A resolução da foto excede o limite de 40 megapixels.');frame=true;}offset+=size;}need(frame&&scan,'A imagem JPEG está incompleta.');mime='image/jpeg';}
 need(mime,'Envie uma foto PNG ou JPEG/JPG. Outros formatos não são permitidos.');
 need((!file.type||file.type===mime)&&(mime==='image/png'?/\.png$/i:/\.(jpe?g)$/i).test(file.name),'O formato e a extensão da foto devem corresponder a PNG ou JPEG/JPG.');return mime;
}

const identitySQL=`SELECT p.id,p.name,p.tutor_id,t.name AS tutor_name,p.breed,p.size,p.species,p.archived,f.id AS photo_id,f.created_at AS photo_updated_at FROM pets p JOIN tutors t ON t.id=p.tutor_id LEFT JOIN files f ON f.id=p.photo_id AND f.pet_id=p.id AND f.kind='photo' AND f.removed_at IS NULL AND f.mime IN ('image/png','image/jpeg')`;
export const photoScope=user=>['registry','operation','health','finance','inventory','reports'];
export const canReadPetIdentity=ctx=>photoScope().some(domain=>ctx.can(ctx.user,domain));
export async function identities(ctx,ids) {if(!ids.length)return [];const observed_at=ctx.now();return (await ctx.rows(ctx.db,identitySQL+' WHERE p.id IN (SELECT value FROM json_each(?))',[JSON.stringify([...new Set(ids)])])).map(p=>({...p,photo_pending:!p.photo_id,observed_at}));}
export async function requirePetPhoto(ctx,id) {
 const pet=(await identities(ctx,[id]))[0];ctx.need(pet?.photo_id,'Foto obrigatória pendente. Atualize a fotografia no cadastro do pet antes de confirmar a operação.');
 const file=await ctx.one(ctx.db,'SELECT object_key FROM files WHERE id=?',[pet.photo_id]);const key=file.object_key||'files/'+pet.photo_id;
 const object=ctx.env.BUCKET?.head?await ctx.env.BUCKET.head(key):await ctx.env.BUCKET?.get(key);ctx.need(object,'A fotografia do pet está indisponível. Atualize a foto no cadastro antes de confirmar a operação.');if(object.body)await object.body.cancel();return pet;
}
export async function withIdentities(ctx,records){const pets=await identities(ctx,records.map(r=>r.pet_id).filter(Boolean)),map=new Map(pets.map(p=>[p.id,p]));return records.map(r=>r.pet_id?{...r,pet_identity:map.get(r.pet_id)||null}:r);}
export async function enrichPetIdentity(ctx,data){const ids=Object.values(data.lists).flatMap(records=>records.flatMap(r=>r.pet_id?[r.pet_id]:[]));ids.push(...(data.lists.pets||[]).map(p=>p.id));data.pet_identities=await identities(ctx,ids);const map=new Map(data.pet_identities.map(p=>[p.id,p]));if(data.lists.pets)data.lists.pets=data.lists.pets.map(p=>({...p,photo_pending:map.get(p.id)?.photo_pending??true}));if(ctx.can(ctx.user,'registry'))data.pet_photo_pending_count=(await ctx.one(ctx.db,`SELECT COUNT(*) AS count FROM pets p LEFT JOIN files f ON f.id=p.photo_id AND f.pet_id=p.id AND f.kind='photo' AND f.removed_at IS NULL AND f.mime IN ('image/png','image/jpeg') WHERE p.archived=0 AND f.id IS NULL`)).count;return data;}

export async function handlePetIdentity(ctx){
 const {request,path,db,user,need,permit,one,rows,insert,update,mutate,uid,now,json}=ctx;
 if(path[0]==='pet-identities'&&request.method==='POST'){
  need(canReadPetIdentity(ctx),'Você não tem permissão para consultar pets.',403);const body=ctx.body;
  if(body.ids){need(Array.isArray(body.ids)&&body.ids.length<=100&&body.ids.every(id=>typeof id==='string'&&id.length<=100),'Consulta de pets inválida.');return json({records:await identities(ctx,body.ids)});}
  const query=String(body.q||'').trim().slice(0,100),offset=Number(body.offset||0),limit=50;need(Number.isSafeInteger(offset)&&offset>=0,'Página inválida.');const where=['p.archived=0'],args=[];
  if(query){where.push('(p.name LIKE ? OR t.name LIKE ? OR p.breed LIKE ? OR p.size LIKE ? OR p.id LIKE ?)');args.push(...Array(5).fill('%'+query.replace(/[%_]/g,'')+'%'));}if(body.tutor_id){where.push('p.tutor_id=?');args.push(body.tutor_id);}if(body.photo_pending)where.push("NOT EXISTS(SELECT 1 FROM files photo WHERE photo.id=p.photo_id AND photo.pet_id=p.id AND photo.kind='photo' AND photo.removed_at IS NULL AND photo.mime IN ('image/png','image/jpeg'))");
  const condition=' WHERE '+where.join(' AND '),total=(await one(db,'SELECT COUNT(*) count FROM pets p JOIN tutors t ON t.id=p.tutor_id'+condition,args)).count;
  const observed_at=now(),records=(await rows(db,identitySQL+condition+' ORDER BY p.name,t.name,p.id LIMIT ? OFFSET ?',[...args,limit,offset])).map(p=>({...p,photo_pending:!p.photo_id,observed_at}));return json({records,total,offset,has_more:offset+records.length<total});
 }
 if(path[0]!=='pets')return null;
 need(['POST','PATCH'].includes(request.method),'Método inválido.',405);const id=path[1];permit(user,'registry',id?'edit':'create');
 if(path[2]==='photo-remove'){
  need(id&&request.method==='POST','Método inválido.',405);const raw=new TextDecoder().decode(await ctx.boundedBody(request,60000));let body;try{body=JSON.parse(raw);}catch{need(false,'Confirmação inválida.');}request.petFingerprint=await ctx.digest(raw);request.petAudit=body;
  const replay=await replayOperation(ctx);if(replay)return replay;need(body.confirmation==='REMOVER FOTO '+id,'Confirme a remoção da fotografia deste pet.');const pet=await one(db,'SELECT * FROM pets WHERE id=?',[id]);need(pet,'Pet não encontrado.',404);need(pet.photo_id,'Este pet já está sem fotografia.');
  return json(await mutate(db,user,request,'pets',id,[update(db,'pets',{photo_id:null},id),update(db,'files',{removed_at:now()},pet.photo_id)],'Remoção confirmada da foto; identificação cadastral pendente'));
 }
 need((request.headers.get('content-type')||'').includes('multipart/form-data'),'Envie o cadastro e a fotografia pelo formulário do pet.',415);
 const encoded=await ctx.boundedBody(request,6*1024*1024),form=await new Response(encoded,{headers:{'Content-Type':request.headers.get('content-type')}}).formData();let fields;try{fields=JSON.parse(String(form.get('fields')||'{}'));}catch{need(false,'Dados do cadastro inválidos.');}need(fields&&typeof fields==='object'&&!Array.isArray(fields),'Dados do cadastro inválidos.');
 const previous=id?await one(db,'SELECT * FROM pets WHERE id=?',[id]):null;need(!id||previous,'Pet não encontrado.',404);const allFields=ctx.cleanFields('pets',{...previous,...fields}),clean=id?Object.fromEntries(Object.entries(allFields).filter(([key])=>Object.hasOwn(fields,key))):allFields;need(!await one(db,'SELECT id FROM tutors WHERE id=? AND anonymized_at IS NOT NULL',[allFields.tutor_id]),'Este cadastro teve os identificadores removidos.');
 const photo=form.get('photo');need(id||photo&&typeof photo.arrayBuffer==='function','A foto do animal é obrigatória para concluir o cadastro. Envie PNG ou JPEG/JPG.');let bytes,mime,hash;
 if(photo&&typeof photo.arrayBuffer==='function'){need(photo.size<=maxPhotoBytes,'A foto deve ter até 5 MB.');bytes=new Uint8Array(await photo.arrayBuffer());mime=validatePetPhoto(photo,bytes,need);hash=await sha256(bytes);}
 request.petFingerprint=await ctx.digest(JSON.stringify({id:id||null,fields,photo:hash||null,name:photo?.name||null}));request.petAudit={...fields,...(photo?{photo:'Fotografia atualizada',file_name:photo.name}:{} )};const replay=await replayOperation(ctx);if(replay)return replay;
 const petId=id||uid(),fileId=photo?uid():null,statements=id?(Object.keys(clean).length?[update(db,'pets',clean,petId)]:[]):[insert(db,'pets',{id:petId,...clean})];
 if(fileId){need(ctx.env.BUCKET,'Armazenamento de fotografias indisponível.',503);await ctx.env.BUCKET.put('files/'+fileId,bytes,{httpMetadata:{contentType:mime}});try{await ctx.env.BUCKET.put('archive/files/'+fileId,bytes,{httpMetadata:{contentType:mime}});const copy=await ctx.env.BUCKET.get('archive/files/'+fileId);need(copy&&await sha256(new Uint8Array(await new Response(copy.body).arrayBuffer()))===hash,'A cópia protegida da fotografia não foi confirmada.',503);}catch(error){await ctx.env.BUCKET.delete('files/'+fileId);await ctx.env.BUCKET.delete('archive/files/'+fileId);throw error;}
  statements.push(insert(db,'files',{id:fileId,pet_id:petId,kind:'photo',name:String(photo.name).slice(0,150),mime,size:photo.size,actor_id:user.id,archive_hash:hash,archive_crc32:crc32(bytes)}),update(db,'pets',{photo_id:fileId},petId));if(previous?.photo_id)statements.push(update(db,'files',{removed_at:now()},previous.photo_id));
 }
 try{const result=await mutate(db,user,request,'pets',petId,statements,photo?'Atualização da fotografia do cadastro mestre':null);if(result.repeated&&fileId){await ctx.env.BUCKET.delete('files/'+fileId);await ctx.env.BUCKET.delete('archive/files/'+fileId);}return json(result);}catch(error){if(fileId){await ctx.env.BUCKET.delete('files/'+fileId);await ctx.env.BUCKET.delete('archive/files/'+fileId);}throw error;}
}
