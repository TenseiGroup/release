# @tensei-group/release

Shareable [semantic-release](https://semantic-release.gitbook.io/) config for Tensei Group projects using [conventional commits](https://www.conventionalcommits.org/).

Forked from [`open-sauced/semantic-release-conventional-config`](https://github.com/open-sauced/semantic-release-conventional-config) (MIT), trimmed to GitHub-only releases for application repos.

## Release rules

| Commit type | Release |
|---|---|
| `feat`, `BREAKING CHANGE` | minor bump (pre-1.0: `0.x` minor, never jumps to `1.0.0`) |
| `fix`, `perf`, `revert`, `refactor` | patch bump |
| `docs`, `style`, `test`, `build`, `ci`, `chore` | no release |

Each release: analyzes commits, generates a changelog, bumps `package.json`, commits `CHANGELOG.md` + `package.json` + lockfile, and creates a GitHub release. No npm publish; these are applications.

## Release voice

The upstream config announces with emoji (🍕 Features). Tensei releases are quieter, per the brand: minimal section names (**New / Fixes / Performance / Refactoring / Reverts**), chore-level commits hidden from output, a one-line tagline in the changelog header, and a single `— 転生` signature at the end of each release entry. Release commits read `chore(release): vX.Y.Z [skip ci]`.

## Setup in a project

1. Install:

   ```sh
   bun add -D @tensei-group/release semantic-release
   ```

2. Create `release.config.js`:

   ```js
   module.exports = {
     extends: "@tensei-group/release",
   };
   ```

3. Add `.github/workflows/release.yml`:

   ```yaml
   name: Release
   on:
     push:
       branches: [main, beta, alpha]
   permissions:
     contents: write
     issues: write
     pull-requests: write
   jobs:
     release:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
           with:
             fetch-depth: 0
         - uses: oven-sh/setup-bun@v2
         - run: bun install --frozen-lockfile
         - run: bunx semantic-release
           env:
             GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
   ```

4. Releases fire on the next conventional commit pushed to `main`. Set `beta`/`alpha` branches for pre-releases.

## Branches

- `main` — stable releases
- `beta`, `alpha` — pre-release channels

## Release branches

Never rewrite history on a release branch (`main`/`beta`). semantic-release numbers
versions by finding the previous release tag in the branch's history; a force-push or
rebase orphans the tagged commit and prerelease numbering restarts (v2.9.0-alpha.1,
v2.9.0-alpha.1, ...). Always merge into release branches, never rebase them. If it
already happened, re-attach the channel note: `git notes --ref semantic-release-<tag>
add -f -m '{"channels":["<branch>"]}' <tag>` then push the notes ref.

## Used by

- [credix-web](https://github.com/takanome-dev/credix-web)
- [fintra-backend](https://github.com/takanome-dev/fintra-backend)

## License

MIT, forked from open-sauced/semantic-release-conventional-config.
