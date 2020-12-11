//
// Copyright 2020 DXOS.org
//

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

import { VersionString } from './version';

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

export interface PackageJson {
  name: PackageName
  version: VersionString
  dependencies: Record<PackageName, VersionString>
  devDependencies: Record<PackageName, VersionString>
}

export interface ExtendedWorkspacePackageInfo extends WorkspacePackageInfo {
  manifest: PackageJson
}

export function getWorkspaceInfo (): Record<PackageName, WorkspacePackageInfo> {
  let res = execSync('yarn workspaces info --json', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'ignore']
  });
  if (res.startsWith('yarn workspaces')) {
    res = res.slice(res.indexOf('\n') + 1, res.lastIndexOf('}') + 1);
  }
  return JSON.parse(res);
}

export function getExtendedWorkspaceInfo (): Record<PackageName, ExtendedWorkspacePackageInfo> {
  const workspaceInfo = getWorkspaceInfo();
  const workspaceRoot = findWorkspaceRoot();

  const res: Record<PackageName, ExtendedWorkspacePackageInfo> = {};
  for (const [key, info] of Object.entries(workspaceInfo)) {
    const packageJsonPath = join(workspaceRoot, info.location, 'package.json');
    const manifest = JSON.parse(readFileSync(packageJsonPath, { encoding: 'utf-8' }));
    res[key] = {
      ...info,
      manifest
    };
  }
  return res;
}

export function getWorkspaceDependencies (): Record<PackageName, Record<VersionString, DependencyInfo[]>> {
  const workspaceInfo = getExtendedWorkspaceInfo();

  const dependenciesRecord: Record<string, Record<string, DependencyInfo[]>> = {};
  for (const [dependent, info] of Object.entries(workspaceInfo)) {
    const { dependencies, devDependencies } = info.manifest;

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

export function changePackageVersion (packageJsonPath: string, dependency: PackageName, version: VersionString) {
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

export function findWorkspaceRoot (from = process.cwd()): string {
  try {
    const pkg = JSON.parse(readFileSync(join(from, 'package.json'), { encoding: 'utf-8' }));
    if (pkg.workspaces) {
      return from;
    }
  } catch {}

  if (from === '/') {
    throw new Error('Cannot find workspace root.');
  }
  return findWorkspaceRoot(dirname(from));
}
