'use client';
import {createContext,useContext,useEffect,useRef,useState,useId} from 'react';
import {Dog,Check,Camera} from 'lucide-react';
import {models} from '../lib/models.mjs';
const IdentityContext=createContext(null);

export function PetIdentityProvider({api,data,editPhoto,children}) {
 const [records,setRecords]=useState(()=>new Map((data.pet_identities||[]).map(p=>[p.id,p]))),[error,setError]=useState('');const watched=useRef(new Set()),queue=useRef(new Set()),timer=useRef(null),current=useRef(records);
 current.current=records;
 const merge=values=>setRecords(prev=>{const next=new Map(prev);for(const p of values)if((p.observed_at||'')>=(prev.get(p.id)?.observed_at||''))next.set(p.id,p);return next;});
 const load=async ids=>{try{for(let offset=0;offset<ids.length;offset+=100){const result=await api('pet-identities',{ids:ids.slice(offset,offset+100)});merge(result.records);}setError('');}catch(e){setError(e.message);}};
 const watch=id=>{if(!id)return;watched.current.add(id);if(current.current.has(id))return;queue.current.add(id);if(!timer.current)timer.current=setTimeout(()=>{const ids=[...queue.current];queue.current.clear();timer.current=null;load(ids);},50);};
 useEffect(()=>{const initial=new Map((data.pet_identities||[]).map(p=>[p.id,p]));setRecords(initial);const missing=[...watched.current].filter(id=>!initial.has(id));if(missing.length)load(missing);},[data]);
 useEffect(()=>{const refresh=()=>{if(!document.hidden&&watched.current.size)load([...watched.current]);};const interval=setInterval(refresh,20000);window.addEventListener('focus',refresh);return()=>{clearInterval(interval);window.removeEventListener('focus',refresh);if(timer.current)clearTimeout(timer.current);};},[api]);
 const remember=p=>merge([p]);
 return <IdentityContext.Provider value={{api,records,watch,remember,editPhoto,canEditPhoto:!!data.permissions.registry.edit,error}}>{children}</IdentityContext.Provider>;
}

function useIdentity(id,fallback){const context=useContext(IdentityContext),cached=context?.records.get(id);useEffect(()=>{context?.watch(id);if(fallback?.observed_at&&(fallback.observed_at>(cached?.observed_at||'')))context?.remember(fallback);},[id,fallback?.observed_at,context?.records]);return fallback?.observed_at&&fallback.observed_at>(cached?.observed_at||'')?fallback:cached||fallback;}
export function PetAvatar({pet,petId,large=false,preview=null}) {
 const id=petId||pet?.id,identity=useIdentity(id,pet),source=preview||identity?.photo_id&&'/api/files/'+identity.photo_id;const [failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[source]);
 return <span className={'pet-avatar '+(large?'large':'')+(!source||failed?' photo-pending':'')} data-pet-id={id}>
  {source&&!failed?<img src={source} alt={'Foto de '+(identity?.name||'pet')} onError={()=>setFailed(true)} loading={preview?'eager':'lazy'}/>:<><Dog size={large?42:26}/><small>{failed?'Foto indisponível':'Foto pendente'}</small></>}
 </span>;
}
export function PetIdentity({petId,pet,record,large=false,compact=false,selected=false}) {
 const fallback=record?.pet_identity||pet,id=petId||fallback?.id||record?.pet_id,identity=useIdentity(id,fallback);
 return <span className={'pet-identity '+(compact?'compact ':'')+(large?'large ':'')+(selected?'selected':'')} data-pet-id={id}>
  <PetAvatar petId={id} pet={identity} large={large}/><span className="pet-identity-copy"><strong>{identity?.name||record?.pet||'Consultando pet…'}</strong>
   {!compact&&<><span>Tutor: {identity?.tutor_name||'Consultando…'}</span><span>{identity?.breed?'Raça: '+identity.breed:'Raça não cadastrada'} · Porte: {identity?.size||'não informado'}</span></>}
   <small className="pet-full-id">ID {id}</small>{(!identity?.photo_id||identity?.photo_pending)&&<small className="photo-pending-label">Atualização cadastral: foto obrigatória pendente</small>}
  </span>
 </span>;
}

export function PetPicker({value='',onChange,label='Pet',required=false,allowPending=false,tutorId=null}) {
 const context=useContext(IdentityContext),inputId=useId(),sequence=useRef(0);const [query,setQuery]=useState(''),[records,setRecords]=useState([]),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const chosen=context?.records.get(value);
 const search=async(next=0)=>{const call=++sequence.current;setBusy(true);try{const result=await context.api('pet-identities',{q:query,tutor_id:tutorId,offset:next});if(call!==sequence.current)return;result.records.forEach(context.remember);setRecords(prev=>next?[...prev,...result.records]:result.records);setOffset(next+result.records.length);setMore(result.has_more);setError('');}catch(e){if(call===sequence.current)setError(e.message);}finally{if(call===sequence.current)setBusy(false);}};
 useEffect(()=>{let active=true;const timer=setTimeout(()=>{if(active)search(0);},200);return()=>{active=false;clearTimeout(timer);};},[query,tutorId]);
 useEffect(()=>{context?.watch(value);},[value]);
 return <div className="visual-pet-picker"><label htmlFor={inputId}><span>{label}{required?' *':''}</span></label><input id={inputId} type="search" placeholder="Pesquisar nome, tutor, raça, porte ou identificação" value={query} onChange={e=>setQuery(e.target.value)}/>
  <div className="pet-picker" aria-label={'Resultados de '+label}>{records.map(p=><div className="pet-picker-result" key={p.id}><button type="button" aria-pressed={p.id===value} className={p.id===value?'selected':''} disabled={!allowPending&&(context.records.get(p.id)||p).photo_pending} onClick={()=>onChange(p.id)} aria-label={'Selecionar pet '+p.name+' · tutor '+p.tutor_name+' · '+(p.breed||'raça não cadastrada')+' · '+p.size+' · ID '+p.id}>
   <PetIdentity pet={p} large selected={p.id===value}/>{p.id===value&&<Check size={20}/>}</button>{(context.records.get(p.id)||p).photo_pending&&context.canEditPhoto&&<button type="button" className="text-btn" onClick={()=>context.editPhoto(p.id)}>Incluir foto de {p.name}</button>}</div>)}</div>
  {busy&&<small role="status">Consultando pets…</small>}{error&&<p className="error" role="alert">{error}</p>}{!busy&&!records.length&&!error&&<p>Nenhum pet encontrado para esta pesquisa.</p>}{more&&<button type="button" className="text-btn" disabled={busy} onClick={()=>search(offset)}>Carregar mais pets</button>}
  {value&&<div className="pet-confirmation"><p>Confira o animal selecionado</p><PetIdentity petId={value} pet={chosen} large/>{chosen?.photo_pending&&!allowPending&&<p className="error">Inclua a foto no cadastro antes de confirmar esta operação.</p>}</div>}
  {!allowPending&&<small>A fotografia faz parte da identificação. Pets sem foto precisam de atualização cadastral antes do atendimento.</small>}
 </div>;
}

function usePhotoPreview(file){const [preview,setPreview]=useState(null);useEffect(()=>{if(!file){setPreview(null);return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);return preview;}
export function PetForm({record={},lists={},ui,save,photoOnly=false,remove}) {
 const {Form}=ui,context=useContext(IdentityContext);const [photo,setPhoto]=useState(null),[error,setError]=useState(''),[confirmation,setConfirmation]=useState(false),[busy,setBusy]=useState(false),[validating,setValidating]=useState(false);const preview=usePhotoPreview(photo),generation=useRef(0),operation=useRef({signature:'',key:''});
 const choose=async file=>{const selection=++generation.current;setValidating(false);setError('');if(!file){setPhoto(null);return;}if(!['image/png','image/jpeg'].includes(file.type)||!/\.(png|jpe?g)$/i.test(file.name)){setError('Envie uma foto PNG ou JPEG/JPG. Outros formatos não são permitidos.');setPhoto(null);return;}if(!file.size||file.size>5*1024*1024){setError('A foto deve ter até 5 MB.');setPhoto(null);return;}setValidating(true);try{const bitmap=await createImageBitmap(file);bitmap.close();if(selection===generation.current)setPhoto(file);}catch{if(selection!==generation.current)return;setError('A imagem não pôde ser lida. Escolha uma fotografia PNG ou JPEG/JPG válida.');setPhoto(null);}finally{if(selection===generation.current)setValidating(false);}};
 const submit=async fields=>{if(validating)throw Error('Aguarde a validação e a prévia da fotografia antes de salvar.');if(error)throw Error(error);if(!record.id&&!photo)throw Error('A foto do animal é obrigatória para concluir o cadastro.');if(photoOnly&&!photo)throw Error('Escolha a nova fotografia antes de salvar.');const signature=JSON.stringify({fields,generation:generation.current});if(operation.current.signature!==signature){operation.current={signature,key:crypto.randomUUID()};}const form=new FormData();form.set('fields',JSON.stringify(fields));if(photo)form.set('photo',photo);const response=await fetch('/api/pets'+(record.id?'/'+record.id:''),{method:record.id?'PATCH':'POST',headers:{'Idempotency-Key':operation.current.key},body:form});const result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível salvar a foto e o cadastro.');await save(result);};
 const editor=<section className="pet-photo-editor"><div><PetAvatar pet={record} petId={record.id} large preview={preview}/><div><h3>{photo?'Prévia da nova fotografia':'Fotografia de identificação'}</h3><p>{record.name||'Novo pet'}</p>{record.id&&<small className="pet-full-id">ID {record.id}</small>}<p>PNG ou JPEG/JPG · até 5 MB</p></div></div><label><span>{record.photo_id?'Substituir fotografia':'Enviar fotografia obrigatória'}</span><input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" required={!record.id&&!photo} onChange={e=>choose(e.target.files?.[0])}/></label>{validating&&<p role='status'>Validando fotografia e preparando a prévia…</p>}{error&&<p className="error" role="alert">{error}</p>}{!record.photo_id&&!photo&&<p className="notice">Foto obrigatória pendente. Inclua uma imagem real do animal para identificá-lo nos serviços.</p>}{record.photo_id&&<button type="button" className="text-btn danger" onClick={()=>setConfirmation(true)}>Remover foto atual</button>}</section>;
 const fields=Object.fromEntries(Object.keys(models.pets.fields).map(key=>[key,record[key]??'']));if(!record.id){fields.species='Cão';fields.size='Pequeno';}
 return <><Form fields={photoOnly?{}:models.pets.fields} initial={photoOnly?{}:fields} lists={lists} before={editor} disabled={validating} save={submit} submit={photoOnly?'Salvar fotografia':'Salvar pet e fotografia'}/>
  {confirmation&&<div className="photo-remove-confirmation" role="alertdialog" aria-label="Confirmar remoção da fotografia"><h3>Remover a foto deste pet?</h3><PetIdentity petId={record.id} pet={record} large/><p>O cadastro ficará com a foto obrigatória pendente. Novos agendamentos e confirmações de atendimento exigirão uma nova fotografia. O histórico será preservado.</p><button type="button" className="button secondary" disabled={busy} onClick={()=>setConfirmation(false)}>Manter fotografia</button><button type="button" className="button danger" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await context.api('pets/'+record.id+'/photo-remove',{confirmation:'REMOVER FOTO '+record.id});setConfirmation(false);await remove();}catch(e){setError(e.message);}finally{setBusy(false);}}}>{busy?'Removendo…':'Confirmar remoção da foto'}</button></div>}
 </>;
}

export function PendingPetPhotos({api,data,open}){const context=useContext(IdentityContext),[records,setRecords]=useState([]),[more,setMore]=useState(false),[error,setError]=useState('');const load=async(offset=0)=>{try{const result=await api('pet-identities',{photo_pending:true,offset});result.records.forEach(context.remember);setRecords(prev=>offset?[...prev,...result.records]:result.records);setMore(result.has_more);setError('');}catch(e){setError(e.message);}};useEffect(()=>{load();},[data]);return <><p>Estes cadastros mantêm seus identificadores e históricos. Inclua a fotografia para concluir a identificação operacional.</p>{error&&<p className='error'>{error}</p>}{records.map(p=><div className='history-row' key={p.id}><PetIdentity pet={p} large/><button className='text-btn' onClick={()=>open(p.id)}>Abrir ficha</button>{context.canEditPhoto&&<button className='button secondary' onClick={()=>context.editPhoto(p.id)}>Incluir fotografia</button>}</div>)}{!records.length&&!error&&<p>Nenhum pet com fotografia pendente.</p>}{more&&<button className='button secondary' onClick={()=>load(records.length)}>Carregar mais cadastros pendentes</button>}</>;}
