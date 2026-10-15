import {mkdir,copyFile,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(root,process.argv[2]||'.artifacts/antispin-preview-dist');
const source=path.join(root,'preview/antispin'),vendor=path.join(output,'vendor');
await mkdir(vendor,{recursive:true});
for(const file of ['index.html','app.mjs','volume-skinning.mjs','style.css','antispin-split-same.glb','antispin-split-same.blend'])await copyFile(path.join(source,file),path.join(output,file));
for(const file of ['three.module.js','three.core.js'])await copyFile(path.join(root,'node_modules/three/build',file),path.join(vendor,file));
for(const file of ['controls/OrbitControls.js','utils/BufferGeometryUtils.js','utils/SkeletonUtils.js','loaders/GLTFLoader.js']){
 const input=await readFile(path.join(root,'node_modules/three/examples/jsm',file),'utf8');
 await writeFile(path.join(vendor,path.basename(file)),input.replaceAll('../utils/','./'));
}
await copyFile(path.join(root,'src/models/LICENSE.txt'),path.join(output,'MODEL-LICENSE.txt'));
await copyFile(path.join(root,'node_modules/three/LICENSE'),path.join(output,'THREE-LICENSE.txt'));
console.log(output);
