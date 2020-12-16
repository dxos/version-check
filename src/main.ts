//
// Copyright 2020 DXOS.org
//

import yargs from 'yargs';

import { check } from './commands/check';
import { checkInstalled } from './commands/installed';
import { upgrade, UpgradeOpts } from './commands/upgrade';

// eslint-disable-next-line no-unused-expressions
yargs(process.argv.slice(2))
  .command<{ fix?: boolean }>('$0', 'Check that all packages use same version',
    yargs => yargs
      .alias('f', 'fix')
      .describe('f', 'Fix errors automatically.'),
    argv => {
      try {
        check(!!argv.fix);
      } catch (err) {
        console.error(err);
        process.exit(-1);
      }
    }
  )
  .command<{ package?: string }>('installed', 'Check installed node_modules',
    yargs => yargs
      .string('package')
      .describe('package', 'Display this package only'),
    ({ package: pkg }) => {
      try {
        checkInstalled(pkg);
      } catch (err) {
        console.error(err);
        process.exit(-1);
      }
    }
  )
  .command<UpgradeOpts>('upgrade', 'Upgrade to the latest version from NPM',
    yargs => yargs
      .string('scope')
      .describe('scope', 'Upgrade packages only from specific scope')
      .string('package')
      .describe('package', 'Upgrade this package only')
      .boolean('dry-run')
      .describe('dry-run', 'Show what packages would be updated, but don\'t update them')
      .string('preid')
      .describe('preid', 'Upgrade packages to specific preid')
      .boolean('force')
      .describe('force', 'Force upgrade packages even to lower stability level')
      .boolean('tilde')
      .describe('tilde', 'Use tilde `~` version ranges')
      .string('to')
      .describe('to', 'Force specific version'),
    argv => {
      try {
        upgrade(argv);
      } catch (err) {
        console.error(err);
        process.exit(-1);
      }
    }
  )
  .demandCommand(1)
  .argv;
