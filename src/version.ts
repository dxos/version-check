//
// Copyright 2020 DXOS.org
//

import { compare, minVersion, parse } from 'semver';

export type VersionString = string;

export type Preid = string | undefined;

export function getHighestVersion (versions: VersionString[]): VersionString {
  const versionsSorted = versions.sort((a, b) => compare(minVersion(a)!, minVersion(b)!));
  return versionsSorted[versionsSorted.length - 1];
}

const isRepoReference = (version: VersionString) => version.match(/^[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+$/);
const isTagLiteral = (version: VersionString) => version.match(/^[a-zA-Z0-9_]+$/);

export function getPreid (version: VersionString) {
  if(isRepoReference(version)) return undefined
  if(isTagLiteral(version)) return version;
  const [tag] = minVersion(version)?.prerelease ?? [];
  return typeof tag === 'string' ? tag : undefined;
}

export function getMajor (version: VersionString) {
  if(isRepoReference(version)) return undefined
  if(isTagLiteral(version)) return undefined;
  return minVersion(version)?.major;
}

export function pickHighestCompatibleVersion (versions: VersionString[], major: number | undefined, preid: string | undefined) {
  return versions
    .filter(version => getPreid(version) === preid && (!major || parse(version)?.major === major))
    .sort(compare)
    .reverse()[0];
}

// Defines ordering of preids from most to least stable. undefined is also a valid value and denotes a missing preid.
const PREID_ORDERING: Preid[] = [
  undefined,
  'beta',
  'alpha'
]

export function isMoreStable(a: Preid, b: Preid) {
  const aPos = PREID_ORDERING.indexOf(a);
  const bPos = PREID_ORDERING.indexOf(b);

  if(aPos === -1 || bPos === -1) return false;

  return aPos < bPos;
}
