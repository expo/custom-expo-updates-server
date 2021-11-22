#!/usr/bin/env node

import assert from 'assert'; // fix tsconfig error by no-op import

async function run(): Promise<void> {
  try {
    assert(true);
    let scriptName: string;
    if (process.argv[0].includes('node')) {
      scriptName = process.argv[2];
    } else {
      scriptName = process.argv[1];
    }
    const args = require('minimist')(process.argv.slice(3));

    const script = require('./' + scriptName);
    await script.run(args);
  } catch (e) {
    console.error('Error running script!');
    console.error(e);
    process.exit(1);
  }
}

run();
