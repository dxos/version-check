//
// Copyright 2020 DXOS.org
//

import chalk from 'chalk';
import { join } from 'path';
import { getHighestVersion } from './version';
import { changePackageVersion, getWorkspaceDependencies } from './workspace';

const shouldFix = process.argv.includes('--fix') || process.argv.includes('-f');

const dependenciesRecord = getWorkspaceDependencies();
let shouldError = false;
let didFix = false;
for (const dependency of Object.keys(dependenciesRecord)) {
  if (Object.keys(dependenciesRecord[dependency]).length === 1) {
    continue; // Only a single specifier across all packages.
  }

  if (shouldFix) {
    const top = getHighestVersion(Array.from(new Set(Object.keys(dependenciesRecord[dependency]))))
    
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
