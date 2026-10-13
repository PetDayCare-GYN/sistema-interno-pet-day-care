import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export class LocalDB {
 constructor(path=':memory:'){this.sqlite=new DatabaseSync(path);this.sqlite.exec('PRAGMA foreign_keys=ON;');}
 migrate(){for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(n=>n.endsWith('.sql')).sort())this.sqlite.exec(readFileSync(new URL('../drizzle/'+name,import.meta.url),'utf8'));}
 prepare(sql){const db=this;return {sql,args:[],bind(...args){this.args=args;return this;},async first(){return db.sqlite.prepare(sql).get(...this.args)||null;},async all(){return {results:db.sqlite.prepare(sql).all(...this.args)};},async run(){const r=db.sqlite.prepare(sql).run(...this.args);return {success:true,meta:{changes:r.changes}};}};}
 async batch(statements){this.sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>{const statement=this.sqlite.prepare(s.sql);if(statement.columns().length)return {success:true,results:statement.all(...s.args)};const r=statement.run(...s.args);return {success:true,results:[],meta:{changes:r.changes}};});this.sqlite.exec('COMMIT');return results;}catch(e){this.sqlite.exec('ROLLBACK');throw e;}}
 close(){this.sqlite.close();}
}
export class LocalBucket {
 constructor(){this.objects=new Map();}
 async put(key,value,options){this.objects.set(key,{value:typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value),options});}
 async get(key){const record=this.objects.get(key);return record?{body:new ReadableStream({start(controller){controller.enqueue(record.value);controller.close();}})}:null;}
 async delete(key){this.objects.delete(key);}
}
