#!/usr/bin/env node
// The npm entry for Assigent, so a first install is just:  npx assigent install
//
// "install" (or "update") runs the installer that ships in this package: it copies the agents,
// the skill and the real "assigent" command (Python 3) into your home folder. It never uses sudo.
// Any other command is passed on to the installed command.
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pkgRoot = path.resolve(__dirname, '..');
const installed = path.join(os.homedir(), '.local', 'bin', 'assigent');
const args = process.argv.slice(2);
const cmd = args[0] || '';

function run(file, argv) {
  const r = spawnSync(file, argv, { stdio: 'inherit' });
  if (r.error) {
    console.error(`Could not start ${file}: ${r.error.message}`);
    process.exit(1);
  }
  process.exit(r.status === null ? 1 : r.status);
}

if (cmd === 'install' || cmd === 'update') {
  run('bash', [path.join(pkgRoot, 'install.sh')]);
}

if (fs.existsSync(installed)) {
  run('python3', [installed, ...args]);
}

if (cmd === '--version' || cmd === '-V') {
  console.log('assigent ' + require(path.join(pkgRoot, 'package.json')).version + ' (not installed yet)');
  process.exit(0);
}

console.log('Assigent is not installed on this machine yet.');
console.log('Install it with:  npx assigent install');
process.exit(cmd === '' || cmd === 'help' || cmd === '--help' || cmd === '-h' ? 0 : 1);
