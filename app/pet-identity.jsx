'use client';
import {createContext,useContext,useEffect,useRef,useState,useId} from 'react';
import {Dog,Check,Move} from 'lucide-react';
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
// Enquadramento não-destrutivo da fotografia: x,y (posição em %) e zoom. O mesmo
// recorte é reproduzido em qualquer tamanho de área porque usa object-position
// (percentual) + transform:scale (adimensional). Centro é o padrão (= foto atual).
export const DEFAULT_FOCUS={x:50,y:50,zoom:1};
const clampNumber=(value,lo,hi,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.min(hi,Math.max(lo,n)):fallback;};
export function readFocus(raw){
 if(!raw)return {...DEFAULT_FOCUS};
 let value=raw;if(typeof raw==='string'){try{value=JSON.parse(raw);}catch{return {...DEFAULT_FOCUS};}}
 if(!value||typeof value!=='object')return {...DEFAULT_FOCUS};
 return {x:clampNumber(value.x,0,100,50),y:clampNumber(value.y,0,100,50),zoom:clampNumber(value.zoom,1,4,1)};
}
export function focusStyle(focus){const f=readFocus(focus);return {objectPosition:`${f.x}% ${f.y}%`,...(f.zoom>1?{transform:`scale(${f.zoom})`,transformOrigin:`${f.x}% ${f.y}%`}:{})};}
export function PetAvatar({pet,petId,large=false,preview=null,focus=undefined}) {
 const id=petId||pet?.id,identity=useIdentity(id,pet),source=preview||identity?.photo_id&&'/api/files/'+identity.photo_id;const [failed,setFailed]=useState(false);
 const appliedFocus=focus!==undefined?focus:identity?.photo_focus;
 useEffect(()=>setFailed(false),[source]);
 return <span className={'pet-avatar '+(large?'large':'')+(!source||failed?' photo-pending':'')} data-pet-id={id}>
  {source&&!failed?<img src={source} alt={'Foto de '+(identity?.name||'pet')} onError={()=>setFailed(true)} loading={preview?'eager':'lazy'} decoding="async" style={focusStyle(appliedFocus)}/>:<><Dog size={large?42:26}/><small>{failed?'Foto indisponível':'Foto pendente'}</small></>}
 </span>;
}
export function PetIdentity({petId,pet,record,large=false,compact=false,selected=false}) {
 const fallback=record?.pet_identity||pet,id=petId||fallback?.id||record?.pet_id,identity=useIdentity(id,fallback);
 return <span className={'pet-identity '+(compact?'compact ':'')+(large?'large ':'')+(selected?'selected':'')} data-pet-id={id}>
  <PetAvatar petId={id} pet={identity} large={large}/><span className="pet-identity-copy"><strong>{identity?.name||record?.pet||'Consultando pet…'}</strong>
   {!compact&&<><span>Tutor: {identity?.tutor_name||'Consultando…'}</span><span>{identity?.breed?'Raça: '+identity.breed:'Raça não cadastrada'} · Porte: {identity?.size||'não informado'}</span></>}
   {(!identity?.photo_id||identity?.photo_pending)&&<small className="photo-pending-label">Atualização cadastral: foto obrigatória pendente</small>}
  </span>
 </span>;
}

export function PetPicker({value='',onChange,label='Pet',required=false,allowPending=false,tutorId=null}) {
 const context=useContext(IdentityContext),inputId=useId(),sequence=useRef(0);const [query,setQuery]=useState(''),[records,setRecords]=useState([]),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const chosen=context?.records.get(value);
 const search=async(next=0)=>{const call=++sequence.current;setBusy(true);try{const result=await context.api('pet-identities',{q:query,tutor_id:tutorId,offset:next});if(call!==sequence.current)return;result.records.forEach(context.remember);setRecords(prev=>next?[...prev,...result.records]:result.records);setOffset(next+result.records.length);setMore(result.has_more);setError('');}catch(e){if(call===sequence.current)setError(e.message);}finally{if(call===sequence.current)setBusy(false);}};
 useEffect(()=>{let active=true;const timer=setTimeout(()=>{if(active)search(0);},200);return()=>{active=false;clearTimeout(timer);};},[query,tutorId]);
 useEffect(()=>{context?.watch(value);},[value]);
 return <div className="visual-pet-picker"><label htmlFor={inputId}><span>{label}{required?' *':''}</span></label><input id={inputId} type="search" placeholder="Pesquisar nome, tutor, raça, porte ou identificação" value={query} onChange={e=>setQuery(e.target.value)}/>
  <div className="pet-picker" aria-label={'Resultados de '+label}>{records.map(p=><div className="pet-picker-result" key={p.id}><button type="button" aria-pressed={p.id===value} className={p.id===value?'selected':''} disabled={!allowPending&&(context.records.get(p.id)||p).photo_pending} onClick={()=>onChange(p.id)} aria-label={'Selecionar pet '+p.name+' · tutor '+p.tutor_name+' · '+(p.breed||'raça não cadastrada')+' · '+p.size}>
   <PetIdentity pet={p} large selected={p.id===value}/>{p.id===value&&<Check size={20}/>}</button>{(context.records.get(p.id)||p).photo_pending&&context.canEditPhoto&&<button type="button" className="text-btn" onClick={()=>context.editPhoto(p.id)}>Incluir foto de {p.name}</button>}</div>)}</div>
  {busy&&<small role="status">Consultando pets…</small>}{error&&<p className="error" role="alert">{error}</p>}{!busy&&!records.length&&!error&&<p>Nenhum pet encontrado para esta pesquisa.</p>}{more&&<button type="button" className="text-btn" disabled={busy} onClick={()=>search(offset)}>Carregar mais pets</button>}
  {value&&<div className="pet-confirmation"><p>Confira o animal selecionado</p><PetIdentity petId={value} pet={chosen} large/>{chosen?.photo_pending&&!allowPending&&<p className="error">Inclua a foto no cadastro antes de confirmar esta operação.</p>}</div>}
  {!allowPending&&<small>A fotografia faz parte da identificação. Pets sem foto precisam de atualização cadastral antes do atendimento.</small>}
 </div>;
}

function usePhotoPreview(file){const [preview,setPreview]=useState(null);useEffect(()=>{if(!file){setPreview(null);return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);return preview;}
// Modal "Mover e redimensionar" (estilo WhatsApp): arraste para posicionar, zoom
// por slider/scroll/botões, prévia ao vivo. O palco é um quadrado arredondado
// renderizado EXATAMENTE como o avatar (object-fit:cover + object-position + scale),
// então o que se vê é o que ficará salvo. Não-destrutivo: devolve só {x,y,zoom}.
function PhotoFramerModal({src,initialFocus,onCancel,onConfirm}){
 const ref=useRef(null),stageRef=useRef(null),drag=useRef(null);
 const [focus,setFocus]=useState(initialFocus);
 useEffect(()=>{const d=ref.current;if(d&&!d.open){try{d.showModal();}catch{}}},[]);
 const bump=patch=>setFocus(f=>({...f,...(typeof patch==='function'?patch(f):patch)}));
 const start=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;const r=stageRef.current.getBoundingClientRect();drag.current={px:e.clientX,py:e.clientY,x:focus.x,y:focus.y,w:r.width||1,h:r.height||1};try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}};
 const move=e=>{if(!drag.current)return;const dx=(e.clientX-drag.current.px)/drag.current.w*100,dy=(e.clientY-drag.current.py)/drag.current.h*100;setFocus(f=>({...f,x:clampNumber(drag.current.x-dx,0,100,50),y:clampNumber(drag.current.y-dy,0,100,50)}));};
 const end=e=>{if(!drag.current)return;drag.current=null;try{e.currentTarget.releasePointerCapture(e.pointerId);}catch{}};
 const wheel=e=>{e.preventDefault();setFocus(f=>({...f,zoom:clampNumber(f.zoom-(e.deltaY>0?0.14:-0.14),1,4,1)}));};
 const zoomTo=v=>setFocus(f=>({...f,zoom:clampNumber(v,1,4,1)}));
 return <dialog className="framer-dialog" ref={ref} onCancel={e=>{e.preventDefault();onCancel();}} onClick={e=>{if(e.target===ref.current)onCancel();}}>
  <p className="framer-title">Mover e redimensionar</p>
  <div className="framer-stage" ref={stageRef} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onWheel={wheel}>
   <img src={src} alt="Ajuste do enquadramento" draggable={false} style={focusStyle(focus)}/>
   <span className="framer-hint"><Move size={13}/>Arraste para enquadrar</span>
  </div>
  <div className="framer-zoom">
   <button type="button" className="framer-zoom-btn" aria-label="Diminuir zoom" onClick={()=>zoomTo(focus.zoom-0.25)}>−</button>
   <input type="range" min="1" max="4" step="0.02" value={focus.zoom} aria-label="Zoom" onChange={e=>zoomTo(e.target.value)}/>
   <button type="button" className="framer-zoom-btn" aria-label="Aumentar zoom" onClick={()=>zoomTo(focus.zoom+0.25)}>+</button>
  </div>
  <div className="framer-actions">
   <button type="button" className="framer-btn" onClick={onCancel}>Cancelar</button>
   <button type="button" className="framer-center" onClick={()=>bump({x:50,y:50})}>Centralizar</button>
   <button type="button" className="framer-btn primary" onClick={()=>onConfirm(focus)}>Escolher</button>
  </div>
 </dialog>;
}
export function PetForm({record={},lists={},ui,save,photoOnly=false,remove}) {
 const {Form}=ui,context=useContext(IdentityContext);const [photo,setPhoto]=useState(null),[error,setError]=useState(''),[confirmation,setConfirmation]=useState(false),[busy,setBusy]=useState(false),[validating,setValidating]=useState(false),[focus,setFocus]=useState(()=>readFocus(record.photo_focus)),[framerOpen,setFramerOpen]=useState(false);const preview=usePhotoPreview(photo),generation=useRef(0),operation=useRef({signature:'',key:''});
 const savedFocus=readFocus(record.photo_focus);
 const choose=async file=>{const selection=++generation.current;setValidating(false);setError('');if(!file){setPhoto(null);return;}if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!/\.(png|jpe?g|webp)$/i.test(file.name)){setError('Envie uma foto PNG, JPEG/JPG ou WEBP. Outros formatos não são permitidos.');setPhoto(null);return;}if(!file.size||file.size>5*1024*1024){setError('A foto deve ter até 5 MB.');setPhoto(null);return;}setValidating(true);try{const bitmap=await createImageBitmap(file);bitmap.close();if(selection===generation.current){setPhoto(file);setFocus({...DEFAULT_FOCUS});setFramerOpen(true);}}catch{if(selection!==generation.current)return;setError('A imagem não pôde ser lida. Escolha uma fotografia PNG, JPEG/JPG ou WEBP válida.');setPhoto(null);}finally{if(selection===generation.current)setValidating(false);}};
 const focusChanged=JSON.stringify(focus)!==JSON.stringify(savedFocus);
 const submit=async fields=>{if(validating)throw Error('Aguarde a validação e a prévia da fotografia antes de salvar.');if(error)throw Error(error);if(!record.id&&!photo)throw Error('A foto do animal é obrigatória para concluir o cadastro.');if(photoOnly&&!photo&&!(record.photo_id&&focusChanged))throw Error('Escolha uma nova fotografia ou ajuste o enquadramento antes de salvar.');const signature=JSON.stringify({fields,focus,generation:generation.current});if(operation.current.signature!==signature){operation.current={signature,key:crypto.randomUUID()};}const form=new FormData();form.set('fields',JSON.stringify(fields));form.set('focus',JSON.stringify(focus));if(photo)form.set('photo',photo);const response=await fetch('/api/pets'+(record.id?'/'+record.id:''),{method:record.id?'PATCH':'POST',headers:{'Idempotency-Key':operation.current.key},body:form});const result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível salvar a foto e o cadastro.');await save(result);};
 const framerSrc=preview||(record.photo_id?'/api/files/'+record.photo_id:null);
 const editor=<section className="pet-photo-editor">
  <div className="pet-photo-editor-head">
   {framerSrc&&<PetAvatar pet={record} petId={record.id} large preview={preview} focus={focus}/>}
   <div>
    <h3>{photo?'Nova fotografia':record.photo_id?'Fotografia do pet':'Fotografia de identificação'}</h3>
    <p>{record.name||'Novo pet'}</p>
    <p className="muted-note">A imagem preenche a mesma área (quadrada) em todo o sistema. PNG, JPEG/JPG ou WEBP · até 5 MB.</p>
    {framerSrc&&<button type="button" className="button secondary" onClick={()=>setFramerOpen(true)}><Move size={15}/>Ajustar enquadramento</button>}
   </div>
  </div>
  <label><span>{record.photo_id?'Substituir fotografia':'Enviar fotografia obrigatória'}</span><input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" required={!record.id&&!photo} onChange={e=>choose(e.target.files?.[0])}/></label>
  {validating&&<p role='status'>Validando fotografia e preparando a prévia…</p>}{error&&<p className="error" role="alert">{error}</p>}{!record.photo_id&&!photo&&<p className="notice">Foto obrigatória pendente. Inclua uma imagem real do animal para identificá-lo nos serviços.</p>}{record.photo_id&&<button type="button" className="text-btn danger" onClick={()=>setConfirmation(true)}>Remover foto atual</button>}
 </section>;
 const fields=Object.fromEntries(Object.keys(models.pets.fields).map(key=>[key,record[key]??'']));if(!record.id){fields.species='Cão';fields.size='Pequeno';}
 return <><Form fields={photoOnly?{}:models.pets.fields} initial={photoOnly?{}:fields} lists={lists} before={editor} disabled={validating} save={submit} submit={photoOnly?'Salvar fotografia':'Salvar pet e fotografia'}/>
  {framerOpen&&framerSrc&&<PhotoFramerModal src={framerSrc} initialFocus={focus} onCancel={()=>setFramerOpen(false)} onConfirm={f=>{setFocus(f);setFramerOpen(false);}}/>}
  {confirmation&&<div className="photo-remove-confirmation" role="alertdialog" aria-label="Confirmar remoção da fotografia"><h3>Remover a foto deste pet?</h3><PetIdentity petId={record.id} pet={record} large/><p>O cadastro ficará com a foto obrigatória pendente. Novos agendamentos e confirmações de atendimento exigirão uma nova fotografia. O histórico será preservado.</p><button type="button" className="button secondary" disabled={busy} onClick={()=>setConfirmation(false)}>Manter fotografia</button><button type="button" className="button danger" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await context.api('pets/'+record.id+'/photo-remove',{confirmation:'REMOVER FOTO '+record.id});setConfirmation(false);await remove();}catch(e){setError(e.message);}finally{setBusy(false);}}}>{busy?'Removendo…':'Confirmar remoção da foto'}</button></div>}
 </>;
}

export function PendingPetPhotos({api,data,open}){const context=useContext(IdentityContext),[records,setRecords]=useState([]),[more,setMore]=useState(false),[error,setError]=useState('');const load=async(offset=0)=>{try{const result=await api('pet-identities',{photo_pending:true,offset});result.records.forEach(context.remember);setRecords(prev=>offset?[...prev,...result.records]:result.records);setMore(result.has_more);setError('');}catch(e){setError(e.message);}};useEffect(()=>{load();},[data]);return <><p>Estes cadastros mantêm seus identificadores e históricos. Inclua a fotografia para concluir a identificação operacional.</p>{error&&<p className='error'>{error}</p>}{records.map(p=><div className='history-row' key={p.id}><PetIdentity pet={p} large/><button className='text-btn' onClick={()=>open(p.id)}>Abrir ficha</button>{context.canEditPhoto&&<button className='button secondary' onClick={()=>context.editPhoto(p.id)}>Incluir fotografia</button>}</div>)}{!records.length&&!error&&<p>Nenhum pet com fotografia pendente.</p>}{more&&<button className='button secondary' onClick={()=>load(records.length)}>Carregar mais cadastros pendentes</button>}</>;}
