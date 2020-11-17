//
// Copyright 2020 DXOS.org
//

import assert from 'assert';
import chalk from 'chalk';
import { join } from 'path';
import yargs from 'yargs';

import { getPackageManifest, PackageManifest } from './npm';
import { getHighestVersion, getPreid, pickHighestVersionWithPreid, VersionString } from './version';
import { changePackageVersion, getWorkspaceDependencies, PackageName } from './workspace';

yargs(process.argv.slice(2))
  .command<{ fix?: boolean }>('$0', 'Check that all packages use same version',
    yargs => yargs
      .alias('f', 'fix')
      .describe('f', 'Fix errors automatically.'),
    argv => {
      check(!!argv.fix);
    }
  )
  .command<UpgradeOpts>('upgrade', 'Upgrade to the latest version from NPM',
    yargs => yargs
      .string('scope')
      .describe('scope', 'Upgrade packages only from specific scope')
      .string('package')
      .describe('package', 'Upgrade this package only')
      .boolean('dry-run')
      .describe('dry-run', 'Show what packages would be updated, but don\'t update them'),
    argv => {
      upgrade(argv);
    }
  )
  .demandCommand(1)
  // eslint-disable-next-line no-unused-expressions
  .argv;

function check (shouldFix: boolean) {
  const dependenciesRecord = getWorkspaceDependencies();
  let shouldError = false;
  let didFix = false;
  for (const dependency of Object.keys(dependenciesRecord)) {
    if (Object.keys(dependenciesRecord[dependency]).length === 1) {
      continue; // Only a single specifier across all packages.
    }

    if (shouldFix) {
      const top = getHighestVersion(Array.from(new Set(Object.keys(dependenciesRecord[dependency]))));

      for (const infos of Object.values(dependenciesRecord[dependency])) {
        for (const info of infos) {
          const packageJsonPath = join(process.cwd(), info.path, 'package.json');
          changePackageVersion(packageJsonPath, dependency, top);
        }
      }
      console.log(chalk`Updating all versions of {bold ${dependency}} to {bold ${top}}`);
      didFix = true;
    } else {
      shouldError = true;
      console.log();
      console.log(chalk`Found multiple different version specifiers of {bold ${dependency}} in the workspace:`);
      for (const [version, infos] of Object.entries(dependenciesRecord[dependency])) {
        for (const info of infos) {
          console.log(chalk`\t {bold ${version}} in ${join(process.cwd(), info.path, 'package.json')}`);
        }
      }
    }
  }

  if (didFix) {
    console.log();
    console.log(chalk`Don't forget to run {bold yarn} to regenerate the lockfile.`);
  }
  console.log();

  if (shouldError) {
    process.exit(1);
  }
}

interface UpgradeOpts {
  scope?: string,
  package?: string,
  'dry-run'?: string
}

function match (name: PackageName, opts: UpgradeOpts) {
  if (opts.scope && !name.startsWith(opts.scope)) {
    return false;
  }
  if (opts.package && name !== opts.package) {
    return false;
  }
  return true;
}

async function upgrade (opts: UpgradeOpts) {
  const dependencies = getWorkspaceDependencies();

  const packages = Object.keys(dependencies).filter(name => match(name, opts));

  console.log('Querying NPM for package manifests...');
  const manifests: Record<string, PackageManifest> = {};
  await Promise.all(packages.map(async (name) => {
    manifests[name] = await getPackageManifest(name);
  }));
  console.log('Done.\n');

  const updates: Record<PackageName, { from: VersionString, to: VersionString }> = {};
  for (const name of packages) {
    const currentMaxVersion = getHighestVersion(Object.keys(dependencies[name]));
    const preid = getPreid(currentMaxVersion);

    const latestVersion = pickHighestVersionWithPreid(Object.keys(manifests[name].versions), preid);
    assert(latestVersion, `No version found for ${name} with ${preid} preid`);

    for (const version of Object.keys(dependencies[name])) {
      if (version !== latestVersion) {
        updates[name] = { from: version, to: latestVersion };
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    console.log('All packages are up-to-date.');
    process.exit(0);
  }

  console.log('The following updates will be applied:\n');
  for (const [name, { from, to }] of Object.entries(updates)) {
    console.log(chalk`\t{bold ${name}} {bold ${from}} -> {bold ${to}}`);
  }
  console.log('\n\n');

  if (opts['dry-run']) {
    console.log('Dry-run: no changes will be applied.');
    process.exit(0);
  } else {
    for (const [name, { to }] of Object.entries(updates)) {
      for (const infos of Object.values(dependencies[name])) {
        for (const info of infos) {
          const packageJsonPath = join(process.cwd(), info.path, 'package.json');
          changePackageVersion(packageJsonPath, name, to);
        }
      }
    }

    console.log();
    console.log(chalk`Don't forget to run {bold yarn} to regenerate the lockfile.`);
  }
}
