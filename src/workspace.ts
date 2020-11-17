import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { VersionString } from "./version";

export type PackageName = string;

export interface DependencyInfo {
  dependency: string
  package: string
  path: string
  version: string
}

export interface WorkspacePackageInfo {
  location: string
  workspaceDependencies: string[],
  mismatchedWorkspaceDependencies: string[]
}

export function getWorkspaceInfo(): Record<PackageName, WorkspacePackageInfo> {
  return JSON.parse(execSync('yarn workspaces info', {
    encoding: 'utf-8'
  }));
}

export function getWorkspaceDependencies(): Record<PackageName, Record<VersionString, DependencyInfo[]>> {
  const workspaceInfo = getWorkspaceInfo();

  const dependenciesRecord: Record<string, Record<string, DependencyInfo[]>> = {};
  for (const [dependent, info] of Object.entries(workspaceInfo)) {
    const packageJsonPath = join(process.cwd(), info.location, 'package.json');
    const { dependencies, devDependencies } = JSON.parse(readFileSync(packageJsonPath, { encoding: 'utf-8' }));

    for (const [dependency, version] of [...Object.entries(dependencies), ...Object.entries(devDependencies)] as [string, string][]) {
      ((dependenciesRecord[dependency] ??= {})[version] ??= []).push({
        dependency,
        package: dependent,
        path: info.location,
        version
      });
    }
  }

  return dependenciesRecord;
}

export function changePackageVersion(packageJsonPath: string, dependency: PackageName, version: VersionString) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, { encoding: 'utf-8' }));

  let didUpdate = false;
  for (const key of Object.keys(packageJson.dependencies)) {
    if (key === dependency) {
      packageJson.dependencies[key] = version;
      didUpdate = true;
    }
  }
  for (const key of Object.keys(packageJson.devDependencies)) {
    if (key === dependency) {
      packageJson.devDependencies[key] = version;
      didUpdate = true;
    }
  }

  if (didUpdate) {
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }
}
