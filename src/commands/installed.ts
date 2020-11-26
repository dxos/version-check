//
// Copyright 2020 DXOS.org
//

import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { VersionString } from '../version';
import { getWorkspaceInfo, PackageName } from '../workspace';

export function checkInstalled () {
  const installed = getInstalledModules();
  const versions = getInstalledVersions(installed);

  const format = (pkg: InstalledPackage) => versions[pkg.name].size === 1 ? `${pkg.name}@${pkg.version}` : chalk.red(`${pkg.name}@${pkg.version}`);

  console.log('workspace root');
  printSubtree(installed.root, '', format);
  console.log('\n');
  for (const [name, deps] of Object.entries(installed.packages)) {
    console.log(name);
    printSubtree(deps, '', format);
    console.log('\n');
  }

  console.log('\nDuplicates found:');
  for (const [name, version] of Object.entries(versions)) {
    if (version.size === 1) {
      continue;
    }
    console.log(`  ${name}:`);
    for (const ver of version) {
      console.log(`    ${ver}`);
    }
  }
}

interface InstalledPackage {
  name: PackageName
  version: VersionString
  dependencies: InstalledPackage[]
}

function readModules (dir: string): InstalledPackage[] {
  const entries = readdirSync(dir);

  const res: InstalledPackage[] = [];
  for (const dep of entries) {
    const { name, version } = JSON.parse(readFileSync(join(dir, dep, 'package.json'), { encoding: 'utf-8' }));

    const dependencies = existsSync(join(dir, dep, 'node_modules/@dxos'))
      ? readModules(join(dir, dep, 'node_modules/@dxos'))
      : [];

    res.push({
      name,
      version,
      dependencies
    });
  }
  return res;
}

interface InstalledModules {
  root: InstalledPackage[],
  packages: Record<PackageName, InstalledPackage[]>
}

function getInstalledModules (): InstalledModules {
  let root: InstalledPackage[] = [];
  const packages: Record<PackageName, InstalledPackage[]> = {};
  if (existsSync(join(process.cwd(), 'node_modules/@dxos'))) {
    root = readModules(join(process.cwd(), 'node_modules/@dxos'));
  }
  const workspaceInfo = getWorkspaceInfo();
  for (const [name, info] of Object.entries(workspaceInfo)) {
    if (existsSync(join(process.cwd(), info.location, 'node_modules/@dxos'))) {
      packages[name] = readModules(join(process.cwd(), info.location, 'node_modules/@dxos'));
    }
  }
  return {
    root,
    packages
  };
}

function getInstalledVersions (modules: InstalledModules): Record<PackageName, Set<VersionString>> {
  const versions: Record<PackageName, Set<VersionString>> = {};

  function walkTree (packages: InstalledPackage[]) {
    for (const pkg of packages) {
      (versions[pkg.name] ??= new Set()).add(pkg.version);
      walkTree(pkg.dependencies);
    }
  }

  walkTree(modules.root);
  for (const pkg of Object.values(modules.packages)) {
    walkTree(pkg);
  }
  return versions;
}

function printSubtree (packages: InstalledPackage[], spacing: string, format: (pkg: InstalledPackage) => string) {
  for (let i = 0; i < packages.length; i++) {
    console.log(`${spacing}${i !== packages.length - 1 ? '├─ ' : '└─ '} ${format(packages[i])}`);
    printSubtree(packages[i].dependencies, spacing + (i !== packages.length - 1 ? '│  ' : '   '), format);
  }
}
