'use strict';
// Cross-platform Python launcher for npm scripts; no shell interpolation.
const {spawnSync} = require('node:child_process');
const candidates = process.env.PYTHON
  ? [[process.env.PYTHON, []]]
  : [['python3', []], ['python', []], ['py', ['-3']]];
for (const [command, prefix] of candidates) {
  const probe = spawnSync(command, [...prefix, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'], {stdio: 'ignore'});
  if (probe.status !== 0) continue;
  const result = spawnSync(command, [...prefix, ...process.argv.slice(2)], {stdio: 'inherit'});
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}
console.error('Python 3.10+ fehlt. Installieren oder PYTHON auf den Interpreter setzen.');
process.exit(1);
