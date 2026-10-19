#!/usr/bin/env python3
"""Check syntax, version agreement, offline policy and tracked-file hygiene."""
from pathlib import Path
import ast, hashlib, json, re, subprocess, xml.etree.ElementTree as ET
R = Path(__file__).resolve().parents[1]
pkg = json.loads((R/'package.json').read_text(encoding='utf-8'))
lock = json.loads((R/'package-lock.json').read_text(encoding='utf-8'))
v = pkg['version']
assert re.fullmatch(r'\d+\.\d+\.\d+', v)
assert lock['version'] == lock['packages']['']['version'] == v
A = '{http://schemas.android.com/apk/res/android}'
manifest = ET.parse(R/'android/app/src/main/AndroidManifest.xml').getroot()
assert manifest.attrib[A+'versionName'] == v
assert int(manifest.attrib[A+'versionCode']) >= 2
assert not manifest.findall('uses-permission'), 'Offline app must request no permissions'
app = manifest.find('application')
assert app.attrib[A+'allowBackup'] == app.attrib[A+'debuggable'] == 'false'
for file in list((R/'tools').glob('*.py')) + list((R/'tests').glob('*.py')):
    ast.parse(file.read_text(encoding='utf-8'), filename=str(file))
for file in list((R/'web').glob('*.js')) + list((R/'tests').glob('*.js')) + list((R/'tools').glob('*.cjs')):
    subprocess.run(['node', '--check', str(file)], check=True)
for name in ['tools/build_apk.py', 'tools/verify_apk.py', 'tools/build-with-sdk.sh', 'web/app.js', 'web/engine.js']:
    assert v in (R/name).read_text(encoding='utf-8'), f'Version missing in {name}'
html = (R/'web/index.html').read_text(encoding='utf-8')
assert html == (R/'android/app/src/main/assets/index.html').read_text(encoding='utf-8')
assert '/*__' not in html, 'Unexpanded bundle marker'
assert "connect-src 'none'" in html
assert not re.search(r'<(?:script|link)[^>]+(?:src|href)=["\']https?://', html, re.I)
java = (R/'android/app/src/main/java/de/gleisgasse/prototyp/MainActivity.java').read_text(encoding='utf-8')
assert 'setBlockNetworkLoads(true)' in java and 'setBlockNetworkImage(true)' in java
assert 'addJavascriptInterface' not in java
# Check the Git index, not all local files: local test keys/builds are legitimate.
if (R/'.git').exists():
    result = subprocess.run(['git', 'ls-files', '-z'], cwd=R, check=True, capture_output=True)
    paths = result.stdout.decode().split('\0')
    for name in filter(None, paths):
        p = Path(name)
        assert p.suffix.lower() not in {'.pem','.key','.pk8','.der','.jks','.keystore','.apk','.aab','.dex'}, f'Forbidden tracked file: {name}'
        assert not any(part in {'build','build-sdk','node_modules','.signing','secrets'} for part in p.parts), name
        assert not p.name.startswith('.env') or p.name == '.env.example', name
        raw = (R/p).read_bytes()
        assert not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', raw), name
        assert not re.search(rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})', raw), name
        assert name not in {'web/index.html','android/app/src/main/assets/index.html'}, name
print(f'PASS repository checks; app {v}; offline bundle SHA-256 {hashlib.sha256(html.encode()).hexdigest()}')
