import {readFile,writeFile} from 'node:fs/promises';
import {SOURCE_SEQUENCES} from '../src/movement-guides.mjs';
const all=JSON.parse(await readFile('dist/assets/catalog.json','utf8')).flatMap(s=>s.entries);
const stamp=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
const link=(id,t)=>`[${stamp(t)}](https://www.youtube.com/watch?v=${id}&t=${Math.floor(t)}s)`;
let text=`# Movement sequences\n\nThe ordered actions below follow the source videos. The demonstrations teach grip and body technique; the separate 3D studies explain prop geometry and static spatial landmarks.\n\nPositions and actions are source-derived. Diagram distances and depth offsets are illustrative. The original video supplies thumb/index support changes, thumb/pinky passages inside or outside the elbow, shoulder clearance, and body turns. The site does not animate a reconstructed person.\n\n## Continuous movement checkpoints\n\nThese checkpoints are observations to compare with the demonstration, not generated joint poses. Thumb-led and pinky-led antispin use different elbow passages. A future body reconstruction must match those passages and the support changes throughout the full movement, not merely clear a set of collision checks.\n\n`;
for(const [kind,guide] of Object.entries(SOURCE_SEQUENCES)){
 text+=`### ${kind}\n\n`;
 for(const [i,s] of guide.steps.entries())text+=`${i+1}. **${s.position}.** ${s.action} Source: ${link(guide.video,s.time)}.\n`;
 if(guide.pinky)text+=`\nPinky-led variant: ${guide.pinky.action} Source: ${link(guide.video,guide.pinky.time)}.\n`;
 text+='\n';
}
text+=`## Every lesson section, in teaching order\n\nTiming variants retain the source's hand phase and direction. Wheel-plane demonstrations keep distinct left and right working planes. Front-alignment antibrid studies preserve projected relationships while separating the solid staves in depth. Still poses and spatial references do not autoplay.\n\n`;
for(const l of all){text+=`### ${l.id}: ${l.title}\n\n`;for(const [i,m] of l.moves.entries()){
 text+=`#### ${i+1}. ${m.name}\n\nSource: ${link(l.videoId,m.start)}–${stamp(m.end)}.\n\nGrip: ${m.grip}\n\nStance: ${m.stance}\n\nFocus: ${m.focus}\n\n`;
 for(const [j,s] of m.steps.entries())text+=`${j+1}. **${s.title}.** ${s.body}\n`;
 text+=`\nRepresentation: ${!m.motion?'source video':m.motion.kind==='study'?'discrete reference positions':m.motion.still?'still grip reference':m.motion.label||m.motion.kind}. ${m.motion?.note||''}\n\n`;
}}
await writeFile('docs/movement-sequences.md',text.split('\n').map(line=>line.trimEnd()).join('\n').trimEnd()+'\n');
console.log(`Recorded ${all.reduce((n,l)=>n+l.moves.length,0)} ordered sections and ${Object.keys(SOURCE_SEQUENCES).length} shared movement contracts.`);
