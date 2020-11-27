//
// Copyright 2020 DXOS.org
//

import chalk from 'chalk';
import { join } from 'path';
import { satisfies } from 'semver';

import { getHighestVersion } from '../version';
import { changePackageVersion, getExtendedWorkspaceInfo, getWorkspaceDependencies } from '../workspace';

export function check (shouldFix: boolean) {
  const workspaceInfo = getExtendedWorkspaceInfo();
  const dependenciesRecord = getWorkspaceDependencies();
  let shouldError = false;
  let didFix = false;
  for (const dependency of Object.keys(dependenciesRecord)) {
    if (workspaceInfo[dependency]) {
      for (const version of Object.keys(dependenciesRecord[dependency])) {
        if (!satisfies(workspaceInfo[dependency].manifest.version, version)) {
          if (shouldFix) {
            const newVersion = `^${workspaceInfo[dependency].manifest.version}`;
            console.log(chalk`Updating all usages of workspace package {bold ${dependency}} to {bold ${newVersion}}`);
            for (const location of dependenciesRecord[dependency][version]) {
              const packageJsonPath = join(process.cwd(), location.path, 'package.json');
              changePackageVersion(packageJsonPath, dependency, newVersion);
            }
            didFix = true;
          } else {
            shouldError = true;
            console.log(chalk`\n{red error:} Dependency on workspace package {bold ${dependency}} uses a version range incompatible with the current source.`);
            console.log(chalk`Version requested: {bold ${version}}. Current version: {bold ${workspaceInfo[dependency].manifest.version}}`);
            for (const location of dependenciesRecord[dependency][version]) {
              console.log(chalk`  in ${join(process.cwd(), location.path, 'package.json')}`);
            }
            console.log('\n');
          }
        }
      }
    }

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
