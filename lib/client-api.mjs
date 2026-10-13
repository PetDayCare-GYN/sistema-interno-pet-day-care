// One instance per mounted app. Retain the operation key if a response is lost.
export function createApi(fetcher=(...args)=>fetch(...args)){
 const pending=new Map();
 return async function api(path,body,method='POST'){
  const mutating=body!==undefined,serialized=mutating?JSON.stringify(body):undefined;
  const signature=mutating?`${method}:${path}:${serialized}`:null;
  let key=mutating?pending.get(signature):null;
  if(mutating&&!key){key=crypto.randomUUID();pending.set(signature,key);}
  const response=await fetcher('/api/'+path,{method:mutating?method:'GET',headers:mutating?{'Content-Type':'application/json','Idempotency-Key':key}:{},body:serialized});
  const data=await response.json();
  if(!response.ok){if(response.status<500&&mutating)pending.delete(signature);throw Error(data.error||'A operação falhou.');}
  if(mutating)pending.delete(signature);
  return data;
 };
}
