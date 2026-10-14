import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {LocalDB} from '../tests/adapter.mjs';
import {restoreSnapshot} from '../lib/restore-local.mjs';
import {readPortableBackup} from '../lib/portable-backup.mjs';
const [destination,...sources]=process.argv.slice(2);
if(!sources.length||!destination)throw Error('Uso: node scripts/restore-backup.mjs banco-novo.sqlite backup.json OU parte1.zip parte2.zip ...');
if(existsSync(resolve(destination)))throw Error('O destino já existe. Escolha um arquivo novo.');
const portable=sources.every(s=>s.toLowerCase().endsWith('.zip'))?await readPortableBackup(sources.map(s=>readFileSync(resolve(s)))):null;
if(!portable&&sources.length!==1)throw Error('Informe um JSON ou todas as partes ZIP.');
const backup=portable?.snapshot||JSON.parse(readFileSync(resolve(sources[0]),'utf8')),folder=resolve(destination)+'.files';if(portable&&existsSync(folder))throw Error('A pasta de anexos já existe.');
const db=new LocalDB(resolve(destination));db.migrate();
try{restoreSnapshot(db.sqlite,backup);if(portable){mkdirSync(folder);for(const [name,bytes]of portable.files)writeFileSync(join(folder,name.slice(6)),bytes);writeFileSync(join(folder,'manifest.json'),JSON.stringify(backup.file_manifest,null,2));}console.log('Backup restaurado em banco separado; relacionamentos, saldos'+(portable?' e anexos':'')+' validados.');}finally{db.close();}
