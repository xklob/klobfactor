// Schematic interpolation of observed archer checkpoints, not measured joints.
// DrexFactor 2WMkronsmfo: solo 2:16–3:05, paired 3:54–4:54.
// Extra underarm points provide model clearance; their distances are illustrative.
export const ARCHER_KEYS = [
  {
    "u": 0,
    "l": [
      0.65,
      1.28,
      0.36
    ],
    "la": [
      0,
      1,
      0
    ],
    "le": [
      0.03,
      1,
      0.42
    ],
    "r": [
      1.65,
      1.3,
      0.15
    ],
    "ra": [
      0,
      1,
      0
    ],
    "cue": "Thumbs up"
  },
  {
    "u": 0.125,
    "l": [
      0.65,
      1.56,
      0.14
    ],
    "la": [
      0.94,
      0,
      -0.342
    ],
    "le": [
      0.05,
      1.4,
      0.4
    ],
    "r": [
      1.65,
      1.45,
      -0.05
    ],
    "ra": [
      -0.94,
      0,
      0.342
    ],
    "cue": "Thumbs inward, over arm"
  },
  {
    "u": 0.25,
    "l": [
      0.65,
      1.56,
      0.05
    ],
    "la": [
      0,
      -0.8,
      -0.6
    ],
    "le": [
      0.1,
      1.65,
      0.4
    ],
    "r": [
      1.65,
      1.45,
      -0.1
    ],
    "ra": [
      0,
      -0.8,
      -0.6
    ],
    "cue": "Thumb down behind shoulder, pinkies up"
  },
  {
    "u": 0.375,
    "l": [
      0.65,
      1.56,
      -0.22
    ],
    "la": [
      -0.94,
      0,
      -0.342
    ],
    "le": [
      0.12,
      1.5,
      0.4
    ],
    "r": [
      1.65,
      1.45,
      -0.05
    ],
    "ra": [
      0.94,
      0,
      0.342
    ],
    "cue": "Pinkies inward, over-arm return"
  },
  {
    "u": 0.4,
    "l": [
      0.65,
      1.56,
      0.35
    ],
    "la": [
      -0.94,
      0,
      -0.342
    ],
    "le": [
      0.12,
      1.5,
      0.4
    ],
    "r": [
      1.65,
      1.45,
      0.05
    ],
    "ra": [
      0.94,
      0,
      0.342
    ],
    "cue": "Schematic clearance, recover to front while staff is above arm",
    "clearanceOnly": true
  },
  {
    "u": 0.5,
    "l": [
      0.65,
      1.28,
      0.36
    ],
    "la": [
      0,
      1,
      0
    ],
    "le": [
      0.03,
      1,
      0.42
    ],
    "r": [
      1.65,
      1.3,
      0.15
    ],
    "ra": [
      0,
      1,
      0
    ],
    "cue": "Thumbs up"
  },
  {
    "u": 0.625,
    "l": [
      0.65,
      1,
      0.65
    ],
    "la": [
      0.94,
      0,
      0.342
    ],
    "le": [
      0.05,
      0.92,
      0.45
    ],
    "r": [
      1.65,
      1.4,
      0.05
    ],
    "ra": [
      -0.94,
      0,
      -0.342
    ],
    "cue": "Thumbs inward, under arm"
  },
  {
    "u": 0.65,
    "l": [
      1.03,
      0.92,
      0.65
    ],
    "la": [
      0.94,
      0,
      0.342
    ],
    "le": [
      0.35,
      0.92,
      0.6
    ],
    "r": [
      1.65,
      1.38,
      0.15
    ],
    "ra": [
      -0.89,
      -0.23,
      -0.39
    ],
    "cue": "Schematic clearance, move outside chest",
    "clearanceOnly": true
  },
  {
    "u": 0.67,
    "l": [
      1.03,
      0.92,
      0.65
    ],
    "la": [
      0.45,
      -0.2,
      0.87
    ],
    "le": [
      0.35,
      0.92,
      0.6
    ],
    "r": [
      1.65,
      1.36,
      0.25
    ],
    "ra": [
      -0.65,
      -0.52,
      0.55
    ],
    "cue": "Schematic clearance, pinky below upper arm",
    "clearanceOnly": true
  },
  {
    "u": 0.7,
    "l": [
      1.03,
      0.85,
      0.35
    ],
    "la": [
      0.45,
      -0.4,
      0.8
    ],
    "le": [
      0.35,
      0.86,
      0.55
    ],
    "r": [
      1.65,
      1.34,
      0.4
    ],
    "ra": [
      -0.35,
      -0.73,
      0.59
    ],
    "cue": "Schematic clearance, pinky goes behind while below arm",
    "clearanceOnly": true
  },
  {
    "u": 0.75,
    "l": [
      0.65,
      1,
      0.05
    ],
    "la": [
      0,
      -0.8,
      0.6
    ],
    "le": [
      0.2,
      0.95,
      0.4
    ],
    "r": [
      1.65,
      1.3,
      0.55
    ],
    "ra": [
      0,
      -0.8,
      0.6
    ],
    "cue": "Pinkies up, left behind arm and right in front"
  },
  {
    "u": 0.875,
    "l": [
      0.65,
      1,
      0.15
    ],
    "la": [
      -0.94,
      0,
      0.342
    ],
    "le": [
      0.08,
      0.95,
      0.45
    ],
    "r": [
      1.65,
      1.4,
      0.05
    ],
    "ra": [
      0.94,
      0,
      -0.342
    ],
    "cue": "Pinkies inward, underarm return"
  },
  {
    "u": 1,
    "l": [
      0.65,
      1.28,
      0.36
    ],
    "la": [
      0,
      1,
      0
    ],
    "le": [
      0.03,
      1,
      0.42
    ],
    "r": [
      1.65,
      1.3,
      0.15
    ],
    "ra": [
      0,
      1,
      0
    ],
    "cue": "Thumbs up"
  }
];
const unit=a=>{const n=Math.hypot(...a);return a.map(x=>x/n);};
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);
export function archerPose(phase,solo=false) {
  const t=((phase%1)+1)%1;
  const index=ARCHER_KEYS.findIndex((key,i)=>i<ARCHER_KEYS.length-1&&t>=key.u&&t<ARCHER_KEYS[i+1].u);
  const a=ARCHER_KEYS[Math.max(0,index)],b=ARCHER_KEYS[Math.max(0,index)+1];
  const u=(t-a.u)/(b.u-a.u),smooth=u*u*(3-2*u);
  const l=mix(a.l,b.l,smooth),r=mix(a.r,b.r,smooth);
  const left={center:l,axis:unit(mix(unit(a.la),unit(b.la),smooth)),elbow:mix(a.le,b.le,smooth)};
  const right={center:r,axis:unit(mix(unit(a.ra),unit(b.ra),smooth)),elbow:[1.05,1.3,.4*r[2]]};
  const over=t<.5;
  return {hands:solo?[left]:[left,right],guideHands:solo?[null,right]:[],headLean:-.2,
    cue:{title:over?'Over the shoulder':'Under the arm',caption:over?'The thumb end passes behind the shoulder; the close-hand elbow rises.':'The pinky end rises behind the extended arm. The close hand stays below it.'}};
}
