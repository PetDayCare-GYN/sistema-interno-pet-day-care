import {writeFile} from 'node:fs/promises';
const r=await fetch('https://api.github.com/repos/git-for-windows/git/releases/latest',{headers:{'User-Agent':'Pet-Day-Care-build'}});
if(!r.ok)throw Error('Não foi possível consultar o pacote oficial Git.');
const release=await r.json();const asset=release.assets.find(a=>/^MinGit-.*-64-bit.zip$/.test(a.name));
if(!asset)throw Error('Pacote MinGit ausente.');
const response=await fetch(asset.browser_download_url);if(!response.ok)throw Error('Download Git falhou.');
const bytes=Buffer.from(await response.arrayBuffer());const hash=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');
if(asset.digest&&asset.digest!=='sha256:'+hash)throw Error('Hash Git divergente.');
await writeFile('.sites-runtime/mingit.zip',bytes);process.stdout.write(asset.name+'\n');
