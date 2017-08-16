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

### A) Minor or Patch release based on master

If this is a patch release or if you are making a minor release that is equal to the current state of the `master` branch, you can release the `master`-branch directly.

1. Compare changes with the previous release: `git log master...1.2.3` (replace `1.2.3` by the previous version tag)
2. Run: `npm version minor` or `npm version patch`. This will have:
    1. Updated the version in package.json
    2. Regenerated documentation
    3. Committed (git)
    4. Tagged (git)
3. Run: `git push upstream master --tags`
4. Write up the release notes at the new tag on https://github.com/mage/mage/releases/new
5. Run: `npm publish`

### B) Patch release based on a previous release

If we have already merged minor-level commits into `master` that should not land in this patch release, we can cherry-pick our way to a patch release.

1. Create a release branch: `git checkout -b release 1.2.3` (replace `1.2.3` by the previous version tag)
2. Compare changes with `master`: `git log master...release --cherry-pick` (this is where we will pick commits from)
3. Pick all commits you wish to include: `git cherry-pick COMMITHASH` (replace `COMMITHASH`)
4. Run: `npm version patch`. This will have:
    1. Updated the version in package.json
    2. Regenerated documentation
    3. Committed (git)
    4. Tagged (git)
5. Run: `git push upstream --tags`
6. Write up the release notes at the new tag on https://github.com/mage/mage/releases/new
7. Run: `npm publish`

## After publishing the release

Now spread the news on the relevant communication channels.
