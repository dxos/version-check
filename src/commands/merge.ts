import { promises as fs } from 'fs'
import { VersionString } from '../version'
import { compare, minVersion, parse } from 'semver';
import { PackageName } from '../workspace';
import { getHighestVersion } from '..';
import { execSync, spawnSync } from 'child_process';

export interface MergeOpts {
  ancestor: string
  ours: string
  theirs: string
}

const readJsonFile = async (path: string) => JSON.parse(await fs.readFile(path, { encoding: 'utf-8' }))

export async function merge(opts: MergeOpts) {
  const [
    ancestor,
    ours,
    theirs
  ] = await Promise.all([
    readJsonFile(opts.ancestor),
    readJsonFile(opts.ours),
    readJsonFile(opts.theirs),
  ])

  const changes = {
    dependencies: mergeDependencies(ancestor.dependencies ?? {}, ours.dependencies ?? {}, theirs.dependencies ?? {}),
    devDependencies: mergeDependencies(ancestor.devDependencies ?? {}, ours.devDependencies ?? {}, theirs.devDependencies ?? {}),
    peerDependencies: mergeDependencies(ancestor.peerDependencies ?? {}, ours.peerDependencies ?? {}, theirs.peerDependencies ?? {}),
    optionalDependencies: mergeDependencies(ancestor.optionalDependencies ?? {}, ours.optionalDependencies ?? {}, theirs.optionalDependencies ?? {}),
  }

  await fs.writeFile(opts.ours, JSON.stringify(updateJson(ours, changes), null, 2) + '\n')
  await fs.writeFile(opts.theirs, JSON.stringify(updateJson(theirs, changes), null, 2) + '\n')

  const res = spawnSync('git', ['merge-file', opts.ours, opts.ancestor, opts.theirs], { shell: true })

  console.log(`'git merge-file' exited with ${res.status}`)

  process.exit(res.status ?? 1)
}

type Dependencies = Record<PackageName, VersionString>
type DependenciesDiff = Record<PackageName, VersionString | null>

function diffDependencies(from: Dependencies, to: Dependencies): DependenciesDiff {
  const res: DependenciesDiff = {}
  for(const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    if(from[key] !== to[key]) {
      if(!to[key]) {
        res[key] = null
      } else {
        res[key] = to[key]
      }

    }
  }
  return res
}

function mergeDependencies(ancestor: Dependencies, ours: Dependencies, theirs: Dependencies): Dependencies {
  const oursDiff = diffDependencies(ancestor, ours)
  const theirsDiff = diffDependencies(ancestor, theirs)

  for(const key of new Set([...Object.keys(oursDiff), ...Object.keys(theirsDiff)])) {
    console.log(`${key}: ${ancestor[key]} -> ${oursDiff[key] !== undefined ? `ours: ${oursDiff[key]}` : ''} ${theirsDiff[key] !== undefined ? `theirs: ${theirsDiff[key]}` : ''}`)
  }

  const res: Dependencies = {}
  for(const key of new Set([...Object.keys(ancestor), ...Object.keys(oursDiff), ...Object.keys(theirsDiff)])) {
    if (oursDiff[key] && theirsDiff[key]) {
      const pick = getHighestVersion([oursDiff[key]!, theirsDiff[key]!])
      res[key] = pick
    } else if ( // If one of the diffs deletes this dependency.
      oursDiff[key] === null || theirsDiff[key] === null
    ) {
      // Delete dependency
    } else {
      res[key] = oursDiff[key] ?? theirsDiff[key] ?? ancestor[key]
    }
  }

  return res
}

function updateJson(base: any, updatedSections: Record<string, any>) {
  const res = { ...base }
  for(const key of Object.keys(updatedSections)) {
    if(Object.keys(updatedSections[key]).length > 0 || base[key]) {
      res[key] = updatedSections[key]
    }
  }
  return res
}
