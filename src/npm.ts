//
// Copyright 2020 DXOS.org
//

import fetch from 'node-fetch';

import { VersionString } from './version';
import { PackageName } from './workspace';

export interface PackageManifest {
  'dist-tags': Record<string, VersionString>,
  versions: Record<VersionString, unknown>
}

export async function getPackageManifest (name: PackageName): Promise<PackageManifest> {
  const res = await fetch(`https://registry.npmjs.com/${name}`);
  const data = await res.json();
  if (res.status !== 200) {
    throw new Error(`Failed to get package manifest: ${data.error}`);
  }
  return data;
}
