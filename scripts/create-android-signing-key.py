#!/usr/bin/env python3
"""Create a private, reusable local signing key. Never overwrite an existing key."""
import os
from pathlib import Path
import secrets
import subprocess
root = Path.home() / '.config/vulcan-tech-trainer'
key = root / 'release.p12'
properties = root / 'signing.properties'
if key.exists() or properties.exists():
    raise SystemExit('Signing material already exists. Reuse it for compatible updates.')
root.mkdir(parents=True, exist_ok=True, mode=0o700)
password = secrets.token_urlsafe(36)
env = dict(os.environ, VULCAN_KEY_PASSWORD=password)
subprocess.run(['keytool', '-genkeypair', '-keystore', str(key), '-storetype', 'PKCS12',
    '-alias', 'vulcan-tech-trainer', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000',
    '-storepass:env', 'VULCAN_KEY_PASSWORD', '-keypass:env', 'VULCAN_KEY_PASSWORD',
    '-dname', 'CN=Vulcan Tech Trainer, O=Segfault Labs LLC, C=US'],
    env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
key.chmod(0o600)
fd=os.open(properties,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as out:
    out.write(f'storeFile=release.p12\nstorePassword={password}\nkeyAlias=vulcan-tech-trainer\nkeyPassword={password}\n')
print('Created a private release key outside the repository.')
