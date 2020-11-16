# lint-version

Makes sure you only have a single version of a given dependency in a workspace.

## Installation 

Add it to your workspace root:

```
yarn add -DW @dxos/lint-version
```

## Usage

Run with no arguments to check if all dependencies share the same version specifier:

```
lint-version
```

Use `-f` to automatically update all versions to the latest one out of them:

```
lint-version -f
```
