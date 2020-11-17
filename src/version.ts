import { compare, minVersion } from "semver";

export type VersionString = string;

export function getHighestVersion(versions: VersionString[]): VersionString {
  const versionsSorted = versions.sort((a, b) => compare(minVersion(a)!, minVersion(b)!));
  return versionsSorted[versionsSorted.length - 1];
}
