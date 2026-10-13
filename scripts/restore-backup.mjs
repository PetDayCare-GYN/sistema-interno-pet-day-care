import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {LocalDB} from '../tests/adapter.mjs';
import {restoreSnapshot} from '../lib/restore-local.mjs';
const [source,destination]=process.argv.slice(2);
if(!source||!destination)throw Error('Uso: node scripts/restore-backup.mjs backup.json banco-novo.sqlite');
if(existsSync(resolve(destination)))throw Error('O destino já existe. Escolha um arquivo novo.');
const backup=JSON.parse(readFileSync(resolve(source),'utf8'));const db=new LocalDB(resolve(destination));db.migrate();
try{restoreSnapshot(db.sqlite,backup);console.log('Backup restaurado em banco separado; relacionamentos e saldos validados.');}finally{db.close();}
