// Source-verified checkpoints and spatial references. These intentionally do
// not interpolate the unmeasured wrist, elbow, and behind-body transitions.
const point = (id, label, position) => ({id, label, position});
const bodyPoints = [
  point('left-shoulder', 'Left shoulder', [-.55, 1.35, 0]),
  point('right-shoulder', 'Right shoulder', [.55, 1.35, 0]),
  point('left-hip', 'Left hip', [-.55, .05, 0]),
  point('right-hip', 'Right hip', [.55, .05, 0]),
  point('front', 'Front', [0, .65, 1.1]),
  point('rear', 'Behind body', [0, .65, -.9]),
];
const pose = (title, caption, hands, active = []) => ({title, caption, hands, active});
const hand = (center, axis) => ({center, axis});
function cueFrames(move, landmarks) {
  return move.steps.map(step => ({
    title: step.title,
    caption: step.body,
    active: landmarks.filter(p => {
      const text = `${step.title} ${step.body}`.toLowerCase();
      return p.id.split('-').some(word => word.length > 3 && text.includes(word));
    }).map(p => p.id),
  }));
}
export function checkpointStudy(pattern, move) {
  const base = {kind: 'study', trails: false, view: 'perspective'};
  if (pattern.includes('octahedron')) {
    const landmarks = [
      point('up', 'Up', [0, 2.35, 0]), point('down', 'Down', [0, -.75, 0]),
      point('right', 'Performer right', [1.55, .8, 0]), point('left', 'Performer left', [-1.55, .8, 0]),
      point('front', 'Toward audience', [0, .8, 1.55]), point('back', 'Away from audience', [0, .8, -1.55]),
    ];
    const allowBack = /front-back|split-same|timing-transition|solo/.test(pattern);
    const ids = pattern.includes('vertical') ? ['down', 'front', 'up']
      : /horizontal|crossing/.test(pattern) ? ['right', 'front', 'left']
      : allowBack ? landmarks.map(p => p.id) : ['up', 'right', 'down', 'left', 'front'];
    return {...base, label: 'SPATIAL REFERENCE', landmarks,
      edges: [['up','right'],['up','left'],['up','front'],['up','back'],['down','right'],['down','left'],['down','front'],['down','back'],['left','front'],['front','right'],['right','back'],['back','left']],
      frames: ids.map(id => ({title: landmarks.find(p => p.id === id).label,
        caption: 'A spatial landmark, not a hand trajectory. Use the source passage for the order, staff facing, and plane change.', active: [id]})),
      note: allowBack ? 'Explore the six reference directions. The source determines which directions the phrase visits.'
        : 'This drill uses the front crossing. The rear point is shown only to orient the space; it is not part of this demonstrated passage.'};
  }
  if (pattern.includes('archer')) {
    if (pattern.includes('side-switch')) return {...base,label:'Side transfer',
      frames:[
        pose('Right shoulder', 'Complete the weave on the right side before switching.', [hand([.65,1.28,.36],[0,1,0]),hand([1.65,1.3,.15],[0,1,0])]),
        pose('Left shoulder', 'Mirror the close and extended hands. The source demonstrates the transfer at 6:09–6:18.', [hand([-1.65,1.3,.15],[0,1,0]),hand([-.65,1.28,.36],[0,1,0])]),
      ],note:'Endpoint setups only. Use the source for the continuous transfer.'};
    const solo = pattern.includes('solo');
    return {...base, view: 'front', label: 'ARCHER CHECKPOINTS',
      frames: [
        pose('Thumbs up · right-side setup', 'Left hand beside the right shoulder; right arm reaches toward performer-right. These are separated checkpoints. Watch the source for the shoulder and underarm threading.',
          [hand([.55,1.25,.3],[0,1,0]), ...(!solo ? [hand([1.6,1.25,.3],[0,1,0])] : [])]),
        pose('Thumb ends face inward', 'The shoulder hand points toward the extended hand, whose thumb end points back toward the shoulder. Depth and proportions are schematic.',
          [hand([.55,1.25,.3],[1,0,0]), ...(!solo ? [hand([1.6,1.25,.3],[-1,0,0])] : [])]),
      ],
      note: 'Observed front alignments, not an interpolated weave. Source checkpoints: 1:42 / 3:55 and 4:03–4:11. Mirror the view to inspect the layout.'};
  }
  if (pattern.includes('crosser')) {
    return {...base, view: 'front', label: 'CROSSED-ARM SETUP',
      frames: [pose('Crossed arms · thumb ends up', 'Each hand is on its non-native side. The moving phrase turns the torso about 180° and uses shoulder and underarm passages. Watch those changes in the source.',
        [hand([.5,1.0,.45],[0,1,0]),hand([-.5,1.0,.3],[0,1,0])])],
      note: 'The source allows either arm on top. This setup does not animate the body turn or the front–back clearance.'};
  }
  if (pattern.includes('tutting')) {
    const landmarks = [-1.3,0,1.3].flatMap((x,i) => [
      point(`upper-${i}`, ['Left upper','Middle upper','Right upper'][i], [x,1.35,.3]),
      point(`lower-${i}`, ['Left lower','Middle lower','Right lower'][i], [x,.05,.3]),
    ]);
    return {...base, view:'front', label:'3 × 2 WORKING GRID', landmarks,
      edges:[['upper-0','upper-1'],['upper-1','upper-2'],['lower-0','lower-1'],['lower-1','lower-2'],['upper-0','lower-0'],['upper-1','lower-1'],['upper-2','lower-2']],
      frames: cueFrames(move,landmarks),
      note: 'Three columns, two levels. Home base crosses the hands to opposite shoulders. The source shows the folding handoff and staff angles.'};
  }
  if (pattern.includes('hand-tracer')) {
    const landmarks = [point('low','Low alignment',[0,.05,.5]),point('side','Side alignment',[-1.05,.8,.5]),point('top','Overhead crossing',[0,1.75,.5]),point('opposite','Opposite side',[1.05,.8,.5])];
    return {...base, view:'front', label:'HAND-TRACER CHECKPOINTS', landmarks,
      frames:cueFrames(move,landmarks),
      note:'Reference regions, not measured grip paths. At the overhead crossing, the right hand is nearer the body; the next descending staff passes through the gap.'};
  }
  return {...base, label:'BODY-POSITION STUDY', landmarks:bodyPoints,
    frames:cueFrames(move,bodyPoints),
    note:'Highlighted regions accompany the practice cues. They do not prescribe an interpolated staff path. Use the source for the grip changes, turning, and front–back clearance.'};
}
