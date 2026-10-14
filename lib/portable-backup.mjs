import {crc32,sha256} from './zip.mjs';
import {validateSnapshot} from './snapshot.mjs';
// Reads the STORE-only archives emitted by this application, without extracting paths.
export async function readPortableBackup(parts) {
 const entries=new Map();let snapshotText;
 for(const part of parts){const bytes=new Uint8Array(part),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=bytes.length-22;
  while(end>=Math.max(0,bytes.length-65557)&&view.getUint32(end,true)!==0x06054b50)end--;
  if(end<Math.max(0,bytes.length-65557))throw Error('ZIP incompleto.');
  const count=view.getUint16(end+10,true);let cursor=view.getUint32(end+16,true);
  for(let i=0;i<count;i++){if(view.getUint32(cursor,true)!==0x02014b50||view.getUint16(cursor+10,true)!==0)throw Error('Formato de ZIP não suportado.');
   const size=view.getUint32(cursor+24,true),crc=view.getUint32(cursor+16,true),nameSize=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),offset=view.getUint32(cursor+42,true),name=new TextDecoder().decode(bytes.slice(cursor+46,cursor+46+nameSize));
   if(name!=='backup.json'&&!/^files\/[\w-]{1,100}$/.test(name))throw Error('Caminho inesperado no ZIP.');
   if(view.getUint32(offset,true)!==0x04034b50)throw Error('Entrada de ZIP inválida.');
   const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true),content=bytes.slice(start,start+size);if(content.length!==size||crc32(content)!==crc)throw Error('Checksum do ZIP inválido.');
   if(name==='backup.json'){const text=new TextDecoder().decode(content);if(snapshotText&&text!==snapshotText)throw Error('Partes de backups diferentes.');snapshotText=text;}else {if(entries.has(name))throw Error('Arquivo repetido no ZIP.');entries.set(name,content);}
   cursor+=46+nameSize+extra+comment;
  }
 }
 if(!snapshotText)throw Error('Banco ausente do ZIP.');const snapshot=validateSnapshot(JSON.parse(snapshotText));
 for(const file of snapshot.file_manifest||[]){const bytes=entries.get('files/'+file.id);if(!bytes||bytes.length!==file.size||await sha256(bytes)!==file.sha256)throw Error('Faltam partes ou há anexos corrompidos.');}
 return {snapshot,files:entries};
}
