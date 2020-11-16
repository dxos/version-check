import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path';
import { compare, minVersion } from 'semver';
import chalk from 'chalk'

interface DependencyInfo {
  dependency: string
  package: string
  path: string
  version: string
}

interface WorkspacePackageInfo {
  location: string
  workspaceDependencies: string[],
  mismatchedWorkspaceDependencies: string[]
}


const shouldFix = process.argv.includes('--fix') || process.argv.includes('-f');

const workspaceInfo: Record<string, WorkspacePackageInfo> = JSON.parse(execSync('yarn workspaces info', {
  encoding: 'utf-8'
}));

// package => version => info
const dependenciesRecord: Record<string, Record<string, DependencyInfo[]>> = {}

for(const [dependent, info] of Object.entries(workspaceInfo)) {
  const packageJsonPath = join(process.cwd(), info.location, 'package.json')
  const { dependencies, devDependencies } = JSON.parse(readFileSync(packageJsonPath, { encoding: 'utf-8' }));

  for(const [dependency, version] of [...Object.entries(dependencies), ...Object.entries(devDependencies)] as [string, string][]) {
    ((dependenciesRecord[dependency] ??= {})[version] ??= []).push({
      dependency,
      package: dependent,
      path: info.location,
      version,
    }) 
  }
}

let shouldError = false;
let didFix = false;
for(const dependency of Object.keys(dependenciesRecord)) {
  if(Object.keys(dependenciesRecord[dependency]).length === 1) {
    continue; // Only a single specifier across all packages.
  }

  if(shouldFix) {
    const versions = new Set(Object.keys(dependenciesRecord[dependency]));
    const versionsSorted = Array.from(versions).sort((a, b) => compare(minVersion(a)!, minVersion(b)!))
    const top = versionsSorted[versionsSorted.length - 1]

    for(const [version, infos] of Object.entries(dependenciesRecord[dependency])) {
      for(const info of infos) {
        const packageJsonPath = join(process.cwd(), info.path, 'package.json')
        const packageJson = JSON.parse(readFileSync(packageJsonPath, { encoding: 'utf-8' }));

        let didUpdate = false;
        for(const key of Object.keys(packageJson.dependencies)) {
          if(key === dependency) {
            packageJson.dependencies[key] = top;
            didUpdate = true;
          }
        }
        for(const key of Object.keys(packageJson.devDependencies)) {
          if(key === dependency) {
            packageJson.devDependencies[key] = top;
            didUpdate = true;
          }
        }

        if(didUpdate) {
          writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        }
      }
    }
    console.log(chalk`Updating all versions of {bold ${dependency}} to {bold ${top}}`);
    didFix = true;
  } else {
    shouldError = true;
    console.log()
    console.log(chalk`Found multiple different version specifiers of {bold ${dependency}} in the workspace:`);
    for(const [version, infos] of Object.entries(dependenciesRecord[dependency])) {
      for(const info of infos) {
        console.log(chalk`\t {bold ${version}} in ${join(process.cwd(), info.path, 'package.json')}`)
      }
    }
  }
}

if(didFix) {
  console.log()
  console.log(chalk`Don't forget to run {bold yarn} to regenerate the lockfile.`)
}
console.log();

if(shouldError) {
  process.exit(1);
}
