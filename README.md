# version-check

DEPRECATED (see `npm-check-updates`).

Makes sure you only have a single version of a given dependency in a workspace.

## Installation 

Add it to your workspace root:

```
yarn add -DW @dxos/version-check
```

## Usage

### Checking

Run with no arguments to check if all dependencies share the same version specifier:

```bash
yarn version-check
```

Use `-f` to automatically update all versions to the latest one out of them:

```bash
yarn version-check -f
```

#### Checking installed node_modules

The following command prints the entire `node_modules` structure and checks for duplicates.

```bash
yarn version-check installed
```

### Upgrading

Upgrades packages to their latest published version keeping package preid the same: so alpha packages will be upgraded to latest alpha and stable ones will still be stable.

You would still need to run yarn manually afterwards to update the lockfile.

```bash
# Upgrade all @dxos packages to their latest compatible version.
yarn version-check upgrade --scope @dxos

# Upgrade concrete package
yarn version-check upgrade --package @dxos

# Dry-run: only list the changes about to be taken.
yarn version-check upgrade --scope @dxos --dry-run

# Upgrade to specific preid
# NOTE: Beta & release packages won't be upgraded.
yarn version-check upgrade --scope @dxos --preid alpha

# Upgrade even beta & release packages to their latest alpha version
yarn version-check upgrade --scope @dxos --preid alpha --force
```
