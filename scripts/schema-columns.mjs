import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
const snapshots=readdirSync('drizzle/meta').filter(n=>n.endsWith('_snapshot.json')).sort();
const snapshot=JSON.parse(readFileSync('drizzle/meta/'+snapshots.at(-1),'utf8'));
const columns=Object.fromEntries(Object.values(snapshot.tables).map(table=>[table.name,Object.keys(table.columns)]));
writeFileSync('db/columns.mjs','// Generated from the current Drizzle schema; contains no runtime data.\nexport const tableColumns = '+JSON.stringify(columns,null,2)+';\n');
console.log('Metadados de '+Object.keys(columns).length+' tabelas gerados.');
