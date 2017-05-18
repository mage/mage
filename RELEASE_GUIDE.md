# Release Guide

## Versioning scheme

We apply a semver-ish versioning scheme, using the following logic:

- `major`: major version number is always "1"
- `minor`: release includes backwards incompatible changes
- `patch`: bugfix release or backwards compatible changes/features

## How to release

1. Ensure your shell is in the `master` branch
2. Ensure you are up-to-date: `git pull upstream master` (where "upstream" references https://github.com/mage/mage)
3. Determine whether this release is a major, minor or patch release
4. Run: `npm version major`, `npm version minor` or `npm version patch`. This will have:
    1. Updated the version in package.json
    2. Regenerated documentation
    3. Committed (git)
    4. Tagged (git)
5. Run: `git push upstream master --tags` (where "upstream" references https://github.com/mage/mage)
6. Write up the release notes at the new tag on https://github.com/mage/mage/releases/new
7. Run: `npm publish`
8. Spread the news on the relevant communication channels
