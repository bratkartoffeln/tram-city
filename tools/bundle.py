#!/usr/bin/env python3
"""Create a completely self-contained HTML game and copy it into Android assets."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
web = root / 'web'
html = (web / 'index.template.html').read_text(encoding='utf-8')
for marker, filename in [('STYLE','style.css'),('ENGINE','engine.js'),('RENDER','render.js'),('APP','app.js')]:
    html = html.replace('/*__' + marker + '__*/', (web/filename).read_text(encoding='utf-8'))
for dest in [web/'index.html',root/'android/app/src/main/assets/index.html']:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html, encoding='utf-8')
print(f'Bundled {len(html.encode())} bytes, no external dependencies.')
