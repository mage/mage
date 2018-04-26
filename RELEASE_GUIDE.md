# Release Guide

## Versioning scheme

We apply a semver-ish versioning scheme, using the following logic:

- `major`: major version number is always "1"
- `minor`: release includes backwards incompatible changes
- `patch`: bugfix release or backwards compatible changes/features

## How to release

In all the `git` shell commands below, `upstream` references the repository at https://github.com/mage/mage.

1. Ensure your shell is in the `master` branch: `git checkout master`
2. Ensure you are up-to-date: `git pull upstream master`
3. Continue below

### A) Minor release

If you are making a minor release that is equal to the current state of the `master` branch, you can release the `master`-branch directly.

1. Compare changes with the previous release: `git log master...1.2.3` (replace `1.2.3` by the previous version tag)
2. Run: `npm version minor`. This will have:
    1. Updated the version in package.
    2. Updated the version in package-lock.json
    3. Regenerated documentation
    4. Committed (git)
    5. Tagged (git)
3. Run: `git push upstream master --tags`
4. Write up the release notes at the new tag on https://github.com/mage/mage/releases/new
5. Run: `npm publish`

### B) Patch release

To make a patch-release, we cherry-pick commits from master into a temporary branch that will become our release.

1. Create a temporary release branch: `git checkout -b release 1.2.3` (replace `1.2.3` by the previous version that you base this patch release on)
2. Compare changes with `master`: `git log master...release --cherry-pick` (this is where we will pick commits from)
3. Pick all commits you wish to include: `git cherry-pick COMMITHASH` (replace `COMMITHASH`)
4. Run: `npm version patch`. This will have:
    1. Updated the version in package.json
    2. Updated the version in package-lock.json
    3. Regenerated documentation
    4. Committed (git)
    5. Tagged (git)
5. Run: `git push upstream 1.2.4` (replace `1.2.4` by the new version tag)
6. Write up the release notes at the new tag on https://github.com/mage/mage/releases/new
7. Run: `npm publish`
8. Remove your temporary release branch: `git checkout master; git branch -d release`

## After publishing the release

Now spread the news on the relevant communication channels.
