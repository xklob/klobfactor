// Make a file:// preview without a server or network requests. Uses the same
// reviewed source, renderer, and GLB as the hosted preview.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=path.join(root,'.artifacts/antispin-preview-dist');
const output=path.resolve(root,process.argv[2]||'.artifacts/antispin-offline');
await mkdir(output,{recursive:true});
const modules={
  'three':'vendor/three.module.js',
  'three/core':'vendor/three.core.js',
  'three/addons/OrbitControls.js':'vendor/OrbitControls.js',
  'three/addons/GLTFLoader.js':'vendor/GLTFLoader.js',
  'three/addons/BufferGeometryUtils.js':'vendor/BufferGeometryUtils.js',
  'three/addons/SkeletonUtils.js':'vendor/SkeletonUtils.js',
  'preview/volume-skinning':'volume-skinning.mjs',
};
const imports={};
for(const [name,file]of Object.entries(modules)){
  let code=await readFile(path.join(input,file),'utf8');
  code=code.replaceAll("'./three.core.js'","'three/core'")
    .replaceAll("'./BufferGeometryUtils.js'","'three/addons/BufferGeometryUtils.js'")
    .replaceAll("'./SkeletonUtils.js'","'three/addons/SkeletonUtils.js'");
  imports[name]='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
}
const model=(await readFile(path.join(input,'antispin-split-same.glb'))).toString('base64');
let app=await readFile(path.join(input,'app.mjs'),'utf8');
app=app.replace("'./volume-skinning.mjs'","'preview/volume-skinning'")
  .replace("'./antispin-split-same.glb'",JSON.stringify('data:model/gltf-binary;base64,'+model));
let html=await readFile(path.join(input,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="./style.css">','<style>'+await readFile(path.join(input,'style.css'),'utf8')+'</style>')
  .replace(/<script type="importmap">.*?<\/script>/,()=>'<script type="importmap">'+JSON.stringify({imports})+'</script>')
  .replace('<script type="module" src="./app.mjs"></script>',()=>'<script type="module">'+app.replaceAll('</script','<\\/script')+'</script>');
html+='\n<!--\n'+await readFile(path.join(input,'THREE-LICENSE.txt'),'utf8')+'\n'+await readFile(path.join(input,'MODEL-LICENSE.txt'),'utf8')+'\n-->\n';
await writeFile(path.join(output,'Antispin preview.html'),html);
await copyFile(path.join(input,'antispin-split-same.blend'),path.join(output,'antispin-split-same.blend'));
console.log(path.join(output,'Antispin preview.html'));
