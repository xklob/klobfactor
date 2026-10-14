"""Prepare local-only transcript and frame evidence. Never read cookie files."""
from pathlib import Path
import html
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'source-videos'

def prepare(video_id):
    info = json.loads((MEDIA / f'{video_id}.info.json').read_text())
    target = MEDIA / 'analysis' / video_id
    target.mkdir(parents=True, exist_ok=True)
    source = MEDIA / f'{video_id}.en-orig.vtt'
    if not source.exists(): source = MEDIA / f'{video_id}.en.vtt'
    output = [info['title'], f"Duration: {info['duration']} seconds", info.get('description', ''), '']
    if source.exists():
        recent = []
        for cue in re.split(r'\n\s*\n', source.read_text()):
            match = re.search(r'(\d\d:\d\d:\d\d\.\d+) -->', cue)
            if not match: continue
            lines = cue.split('\n')
            start = next(i for i, line in enumerate(lines) if '-->' in line)
            for line in lines[start + 1:]:
                line = html.unescape(re.sub('<[^>]+>', '', line)).strip()
                if line and line not in recent[-3:]:
                    output.append(f'[{match.group(1)}] {line}')
                    recent.append(line)
    (target / 'transcript.txt').write_text('\n'.join(output))
    # One timestamped overview every 20 seconds, up to 16 frames per page.
    if (MEDIA / f'{video_id}.mp4').exists() and not (target / 'sheet-01.jpg').exists():
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(MEDIA / f'{video_id}.mp4'),
            '-vf', "select='isnan(prev_selected_t)+gte(t-prev_selected_t,20)',scale=400:-1,drawtext=text='%{pts\\:hms}':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7,tile=4x4:padding=8:margin=8:color=white", '-fps_mode', 'vfr', '-q:v', '3', str(target/'sheet-%02d.jpg')], check=True)
    print(video_id, info['title'], 'prepared')

for video_id in sys.argv[1:]: prepare(video_id)
