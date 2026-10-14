import {execFileSync} from 'node:child_process';
import {mkdir,rm,cp,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../',import.meta.url)));
execFileSync(process.execPath,['scripts/build.mjs'],{stdio:'inherit'});
const output='android/app/build/generated/trainerAssets';
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp('dist',`${output}/site`,{recursive:true});
await cp('android/viewer',`${output}/site/trainer`,{recursive:true});
const catalog=await readFile('dist/assets/catalog.json');
const data=JSON.parse(catalog),lessons=data.flatMap(s=>s.entries);
if(lessons.length!==21||lessons.reduce((n,l)=>n+l.moves.length,0)!==150)throw new Error('Unexpected curriculum coverage; update the content manifest deliberately.');
// Android reference pages retain the web text and diagrams. Navigation belongs to the native shell.
for(const dir of ['lab','vtg','reference']) {
 const path=`${output}/site/${dir}/index.html`;
 let html=await readFile(path,'utf8');
 html=html.replace('</head>','<link rel="stylesheet" href="/trainer/embedded.css"><script defer src="/trainer/native.js"></script></head>');
 await writeFile(path,html);
}
await writeFile(`${output}/content-manifest.json`,JSON.stringify({webVersion:JSON.parse(await readFile('package.json','utf8')).version,lessons:lessons.length,sections:lessons.reduce((n,l)=>n+l.moves.length,0),catalogSha256:createHash('sha256').update(catalog).digest('hex')},null,2));
console.log(`Android bundle: ${lessons.length} lessons, 150 sections; complete static site and local 3D renderer.`);
