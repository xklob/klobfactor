#!/usr/bin/env python3
"""Run trainer checks on an explicitly selected disposable emulator."""
import argparse
from pathlib import Path
import shutil
import subprocess
p=argparse.ArgumentParser()
p.add_argument('--adb',default='adb');p.add_argument('--serial',required=True);p.add_argument('--stage',type=Path)
a=p.parse_args()
if not a.serial.startswith('emulator-'):
    raise SystemExit('Use a disposable emulator; this test resets only the trainer debug app.')
root=Path(__file__).resolve().parents[1]
def adb(*args):
    result=subprocess.run([a.adb,'-s',a.serial,*args],text=True,capture_output=True,timeout=240)
    if result.returncode:raise SystemExit(result.stderr.strip() or result.stdout.strip() or 'ADB failed')
    return result.stdout
for rel,name in [('debug/app-debug.apk','trainer-debug.apk'),('androidTest/debug/app-debug-androidTest.apk','trainer-test.apk')]:
    apk=root/'android/app/build/outputs/apk'/rel
    if a.stage:
        a.stage.mkdir(parents=True,exist_ok=True);target=a.stage/name;shutil.copyfile(apk,target)
        apk_path=subprocess.check_output(['wslpath','-w',str(target)],text=True).strip()
    else:apk_path=str(apk)
    print(adb('install','-r',apk_path).strip())
# A generated color-pattern clip exercises Android's actual document picker and decoder.
clip=root/'.artifacts/trainer-qa-source.mp4'
clip.parent.mkdir(exist_ok=True)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=128x96:rate=10','-t','460','-an','-c:v','libx264','-preset','ultrafast','-crf','40','-g','10','-y',str(clip)],check=True)
if a.stage:
    target=a.stage/clip.name;shutil.copyfile(clip,target)
    clip_path=subprocess.check_output(['wslpath','-w',str(target)],text=True).strip()
else:clip_path=str(clip)
print(adb('push',clip_path,'/sdcard/Download/trainer-qa-source.mp4').strip())
print(adb('shell','pm','clear','app.segfaultlabs.vulcan_tech_trainer.debug').strip())
try:
    adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
    output=adb('shell','am','instrument','-w','-r','app.segfaultlabs.vulcan_tech_trainer.debug.test/androidx.test.runner.AndroidJUnitRunner')
    print(output)
    (root/'.artifacts/android-device-tests.txt').write_text(output)
    if 'FAILURES' in output or 'INSTRUMENTATION_FAILED' in output or 'OK (' not in output:raise SystemExit('Device checks failed.')
finally:
    adb('shell','svc','wifi','enable');adb('shell','svc','data','enable')
