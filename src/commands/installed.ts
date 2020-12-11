//
// Copyright 2020 DXOS.org
//

import chalk from 'chalk';
import { existsSync, readdirSync, readFileSync, lstatSync } from 'fs';
import { join } from 'path';

import { VersionString } from '../version';
import { getWorkspaceInfo, PackageName } from '../workspace';

export function checkInstalled (nameFilter?: PackageName) {
  const installed = getInstalledModules();
  const versions = getInstalledVersions(installed);

  if (nameFilter) {
    filterPackages(installed, nameFilter);
  }

  const format = (pkg: InstalledPackage) => chalk[versions[pkg.name].size === 1 ? 'white' : 'red'](`${pkg.name}@${pkg.version}${pkg.isSymlink ? chalk.bold` <symlink>` : ''}`);

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
    if(nameFilter && name !== nameFilter) {
      continue;
    }
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
  isSymlink: boolean
  dependencies: InstalledPackage[]
}

function readModules (dir: string): InstalledPackage[] {
  const entries = readdirSync(dir);

  const res: InstalledPackage[] = [];
  for (const dep of entries) {
    const { name, version } = JSON.parse(readFileSync(join(dir, dep, 'package.json'), { encoding: 'utf-8' }));

    const isSymlink = lstatSync(join(dir, dep)).isSymbolicLink();

    const dependencies = (!isSymlink && existsSync(join(dir, dep, 'node_modules/@dxos')))
      ? readModules(join(dir, dep, 'node_modules/@dxos'))
      : [];

    res.push({
      name,
      version,
      isSymlink,
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

function filterPackages(installed: InstalledModules, packageName: PackageName) {
  function walkSubtree(installedPackage: InstalledPackage): boolean {
    let keep = false;
    installedPackage.dependencies = installedPackage.dependencies.filter(dep => {
      if(walkSubtree(dep)) {
        keep = true;
        return true;
      } else {
        return false;
      }
    });

    if(installedPackage.name === packageName) {
      keep = true;
    }
    return keep;
  }

  installed.root = installed.root.filter(dep => {
    return walkSubtree(dep);
  })

  for(const pkg of Object.keys(installed.packages)) {
    installed.packages[pkg] = installed.packages[pkg].filter(dep => {
      return walkSubtree(dep);
    })
    if(installed.packages[pkg].length === 0) {
      delete installed.packages[pkg];
    }
  }
}

function printSubtree (packages: InstalledPackage[], spacing: string, format: (pkg: InstalledPackage) => string) {
  for (let i = 0; i < packages.length; i++) {
    console.log(`${spacing}${i !== packages.length - 1 ? '├─ ' : '└─ '} ${format(packages[i])}`);
    printSubtree(packages[i].dependencies, spacing + (i !== packages.length - 1 ? '│  ' : '   '), format);
  }
}
