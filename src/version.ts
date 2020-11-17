//
// Copyright 2020 DXOS.org
//

import { compare, minVersion } from 'semver';

export type VersionString = string;

export function getHighestVersion (versions: VersionString[]): VersionString {
  const versionsSorted = versions.sort((a, b) => compare(minVersion(a)!, minVersion(b)!));
  return versionsSorted[versionsSorted.length - 1];
}

export function getPreid (version: VersionString) {
  if (version.match(/^[a-zA-Z0-9_]+$/)) { // Not a version but a tag (like "beta")
    return version;
  }
  const [tag] = minVersion(version)?.prerelease ?? [];
  return typeof tag === 'string' ? tag : undefined;
}

export function pickHighestVersionWithPreid (versions: VersionString[], preid: string | undefined) {
  return versions
    .filter(version => getPreid(version) === preid)
    .sort(compare)
    .reverse()[0];
}
