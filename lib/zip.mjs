// Uncompressed ZIP entries keep recovery independent of a compression library.
export function crc32(bytes) {let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function header(length){const bytes=new Uint8Array(length);return {bytes,view:new DataView(bytes.buffer)};}
export function zipStream(entries) {
 const encoder=new TextEncoder();let index=0,offset=0,bodyReader=null,central=[];
 return new ReadableStream({async pull(controller){
  try {
   if(bodyReader){const chunk=await bodyReader.read();if(!chunk.done){controller.enqueue(chunk.value);return;}bodyReader=null;index++;}
   if(index<entries.length){const entry=entries[index],name=encoder.encode(entry.name),local=header(30+name.length);local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x0800,true);local.view.setUint32(14,entry.crc,true);local.view.setUint32(18,entry.size,true);local.view.setUint32(22,entry.size,true);local.view.setUint16(26,name.length,true);local.bytes.set(name,30);
    const directory=header(46+name.length);directory.view.setUint32(0,0x02014b50,true);directory.view.setUint16(4,20,true);directory.view.setUint16(6,20,true);directory.view.setUint16(8,0x0800,true);directory.view.setUint32(16,entry.crc,true);directory.view.setUint32(20,entry.size,true);directory.view.setUint32(24,entry.size,true);directory.view.setUint16(28,name.length,true);directory.view.setUint32(42,offset,true);directory.bytes.set(name,46);central.push(directory.bytes);offset+=local.bytes.length+entry.size;
    const stream=await entry.open();if(!stream)throw Error('Conteúdo do backup indisponível.');bodyReader=stream.getReader();controller.enqueue(local.bytes);return;
   }
   const size=central.reduce((s,b)=>s+b.length,0),end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,entries.length,true);end.view.setUint16(10,entries.length,true);end.view.setUint32(12,size,true);end.view.setUint32(16,offset,true);for(const item of central)controller.enqueue(item);controller.enqueue(end.bytes);controller.close();
  }catch(error){controller.error(error);}
 },async cancel(){if(bodyReader)await bodyReader.cancel();}});
}
