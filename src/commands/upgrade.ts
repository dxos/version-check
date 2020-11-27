//
// Copyright 2020 DXOS.org
//

import chalk from 'chalk';
import { join } from 'path';

import { getPackageManifest, PackageManifest } from '../npm';
import { getHighestVersion, getMajor, getPreid, isMoreStable, pickHighestCompatibleVersion, VersionString } from '../version';
import { changePackageVersion, getWorkspaceDependencies, PackageName } from '../workspace';

export interface UpgradeOpts {
  scope?: string,
  package?: string,
  'dry-run'?: string
  preid?: string
  force?: boolean
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

export async function upgrade (opts: UpgradeOpts) {
  const dependencies = getWorkspaceDependencies();

  const packages = Object.keys(dependencies).filter(name => match(name, opts));

  console.log('Querying NPM for package manifests...');
  const manifests: Record<string, PackageManifest | undefined> = {};
  await Promise.all(packages.map(async (name) => {
    manifests[name] = await getPackageManifest(name);
  }));
  console.log('Done.\n');

  const updates: Record<PackageName, { from: VersionString, to: VersionString }> = {};
  let moreStableInstalled = false;
  for (const name of packages) {
    const currentMaxVersion = getHighestVersion(Object.keys(dependencies[name]));
    const preid = getPreid(currentMaxVersion);

    if (!opts.force && opts.preid && isMoreStable(preid, opts.preid)) {
      console.log(chalk`More stable version for {bold ${name}} is already installed: {bold ${currentMaxVersion}}. Skipping.`);
      moreStableInstalled = true;
      continue;
    }
    if (!manifests[name]) {
      continue;
    }
    const latestVersion = pickHighestCompatibleVersion(Object.keys(manifests[name]!.versions), getMajor(currentMaxVersion), opts.preid ?? preid);
    if (!latestVersion) {
      continue;
    }

    for (const version of Object.keys(dependencies[name])) {
      if (version !== latestVersion) {
        updates[name] = { from: version, to: latestVersion };
      }
    }
  }

  if (moreStableInstalled) {
    console.log(chalk`\nSome packages were skipped. Run with {bold --force} to apply updates to those.\n`);
  }

  if (Object.keys(updates).length === 0) {
    console.log('All packages are up-to-date.');
    process.exit(0);
  }

  console.log('The following updates will be applied:\n');
  for (const [name, { from, to }] of Object.entries(updates)) {
    console.log(chalk`\t{bold ${name}} {red ${from}} -> {green ${to}}`);
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
