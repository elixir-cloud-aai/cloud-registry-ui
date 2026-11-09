# Contributing Guide

First off, thank you for taking the time to contribute.
We welcome contributions of all kinds—bug fixes, new features, documentation, and ideas.



## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Releasing](#releasing)
- [Reporting Issues](#reporting-issues)
- [Style Guidelines](#style-guidelines)



## Ways to Contribute

You can contribute in several ways:
- Reporting bugs
- Suggesting features
- Improving documentation
- Submitting code fixes or enhancements
- Sharing ideas and feedback



## Getting Started

### 1. Fork the Repository

Click the **Fork** button on GitHub.

### 2. Clone Your Fork

```bash
git clone https://github.com/<your-username>/cloud-registry-ui.git
cd cloud-registry-ui
git remote add upstream https://github.com/elixir-cloud-aai/cloud-registry-ui.git
```

### 3. Install Dependencies

```bash
bun install
```

### 4. Run the development server

```bash
bun run dev
```



## Development Workflow

### Create a Branch

Always create a new branch for your work, from `dev`, the default branch:

```bash
git fetch upstream
git checkout -b feat/short-description upstream/dev
```

Branch naming examples:
- `feat/add-login`
- `fix/navbar-bug`
- `docs/update-readme`


### Commit Guidelines

Please refer to [this article](https://github.com/elixir-cloud-aai/elixir-cloud-aai/blob/dev/resources/contributing_guidelines.md#commit-messages) for more information.



## Pull Request Process

1. Ensure your branch is up to date with `dev`, the default branch:

```bash
git fetch upstream
git merge upstream/dev
```

2. Push your changes to the forked repo:

```bash
git push origin your-branch-name
```

3. Open a Pull Request on GitHub, into `dev`

Pull requests are squash-merged, so the title becomes the commit message on
`dev`: it must follow [Conventional
Commits](https://www.conventionalcommits.org/)
(`<type>[(scope)]: <description>`, e.g. `fix: keep the filter after a
reload`) and have at most 50 characters. The CI job "PR title" checks this, also when you edit
the title.

If your change affects what users or operators see or do (e.g. labels,
pages, settings), update the docs in `docs/` with it, and take the
screenshots again if they change (see "Screenshots" in
`docs/development.md`).




## Releasing

Features and fixes are merged into `dev`. Branch `main` only ever moves
forward to commits on `dev` that are released, and release tags are on
`main`. Releases are cut by the maintainers (see
[Compatibility](docs/operator-guide/index.md#compatibility) for the
versions):

1. Shortly before the release, open a release-prep pull request into `dev`:
   add the curated release notes as `docs/releases/<version>.md` and to the
   "Releases" section of `mkdocs.yml`, set the version in `package.json` and in `CITATION.cff`
   (`version`; add or update `date-released`), and update the authors in
   `CITATION.cff`: everyone who committed to the repository, listed by the
   number of lines they committed, then by the number of their commits.
   Each version, also each pre-release (e.g., `X.Y.Z-rc1`), needs its own
   such change. Merge it.

   The release workflow publishes the notes as the start of the GitHub
   release, so they follow the organization's format, which its first job
   checks: an intro paragraph saying what the release brings, with a link to
   the upgrade notes if operators must act, then the sections
   `## Breaking changes`, `## Features`, `## Security`, `## Fixes`,
   `## Documentation` and `## Maintenance` (in this order, empty ones left
   out), holding bullets only, each ending with its issue and pull request
   numbers, e.g., `(#12, #34)`. Links must be absolute (e.g., to
   `https://cloud-registry-ui.readthedocs.io/en/latest/`), as they must also
   work on GitHub; no `## Commits` section and no `**Full Changelog**` line,
   which the workflow adds. The shared action
   [`publish-release`](https://github.com/elixir-cloud-aai/.github/tree/main/actions/publish-release)
   describes the format and its checks.
2. Wait until CI has passed for the push to `dev` of the commit that the
   merge created on `dev` (`<sha>`, not the head of the pull request): the
   release workflow requires a successful CI run for a push of the tagged
   commit (runs for pull requests test merge commits, not the commit
   itself). CI also scans the image with the flags of the release scan
   (the `scan` job), so that a fixable critical or high vulnerability fails
   CI before the tag rather than the release; fix it (e.g., by bumping the
   Bun image of the `Dockerfile`) or, with a reason and an expiry date,
   accept it in `.trivyignore.yaml`. Vulnerabilities published between the
   CI run and the release can still fail the release scan: tag soon after
   CI has passed.
3. Run the release workflow's checks that need no tag, as it runs them
   (keep these commands in sync with the `prepare` job of
   `.github/workflows/release.yml`), in Bash. Run them before tagging: tags
   can't be moved or deleted, and the release workflow checks the tagged
   commit, so a check that fails after the tag is pushed (other than a CI
   run that hasn't finished yet) fails again on re-runs, and the release
   then needs a new version, with its own release-prep pull request. The
   commands expect `origin` to be `elixir-cloud-aai/cloud-registry-ui`
   (replace it with the name of your remote for it otherwise).

   ```bash
   version=X.Y.Z  # e.g. 1.0.0-rc1
   sha=""
   git fetch origin && sha="$(git rev-parse --verify "<sha>^{commit}")"  # the full SHA
   (
       [[ -n "${sha}" ]] || { echo "Fetch failed, or the commit is unknown"; exit 1; }
       git merge-base --is-ancestor "${sha}" origin/dev || { echo "${sha} is not on dev"; exit 1; }
       pattern='^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-(alpha|beta|rc)[1-9][0-9]*)?$'
       [[ "v${version}" =~ ${pattern} ]] || { echo "Not a release version: v${version}"; exit 1; }
       # The files of the commit, not of the working tree
       [[ "$(git show "${sha}:package.json" | jq -r .version)" == "${version}" ]] || { echo "Wrong version in package.json"; exit 1; }
       [[ "$(git show "${sha}:CITATION.cff" | yq -r .version)" == "${version}" ]] || { echo "Wrong version in CITATION.cff"; exit 1; }
       # The format of the notes is checked by the release workflow
       git cat-file -e "${sha}:docs/releases/${version}.md" || { echo "No release notes docs/releases/${version}.md"; exit 1; }
       # Also drafts, which the release workflow can't see before it fails on them
       release="$(gh release view "v${version}" --repo elixir-cloud-aai/cloud-registry-ui 2>&1)" && { echo "A release or draft of v${version} exists: delete a draft"; exit 1; }
       [[ "${release}" == *"release not found"* ]] || { echo "Cannot check the releases: ${release}"; exit 1; }
       runs="$(gh api "repos/elixir-cloud-aai/cloud-registry-ui/actions/workflows/ci.yml/runs?head_sha=${sha}&branch=dev&event=push&status=success&per_page=1" --jq .total_count)"
       (( runs >= 1 )) || { echo "No successful CI run for the push of ${sha} to dev"; exit 1; }
       git merge-base --is-ancestor origin/main "${sha}" || { echo "main can't be fast-forwarded to ${sha}"; exit 1; }
       # Not in the release workflow: advisories published since the CI run
       # (the `audit` job of `ci.yml`), in the lockfile of the commit
       audit="$(mktemp -d)" && git show "${sha}:package.json" > "${audit}/package.json" &&
           git show "${sha}:bun.lock" > "${audit}/bun.lock" || { echo "Cannot read the lockfile of ${sha}"; exit 1; }
       (cd "${audit}" && bun audit --prod --audit-level=high) || { echo "High or critical advisories in the production dependencies"; exit 1; }
   ) && echo "All checks passed"
   ```

   Only if all checks passed, move `main` to the commit, and tag it with a
   signed, annotated tag `vX.Y.Z` (or `vX.Y.Z-alphaN`, `vX.Y.Z-betaN` or
   `vX.Y.Z-rcN` for a pre-release). Each command runs only if the one
   before it succeeded: a tag on a commit that isn't on `main` would use up
   the version.

   ```bash
   git push origin "${sha}:main" &&  # fails unless it is a fast-forward
       git tag -s "v${version}" "${sha}" -m "v${version}" &&
       git push origin "v${version}"
   ```

   No workflow of this repository deploys `main`, but a hosting project may
   follow it (a Vercel project follows this repository): check its settings
   before you move `main`. If it deploys `main`, also for pre-releases, move
   `main` no earlier than the registry the release needs is deployed.
4. Approve the jobs of the release workflow (`.github/workflows/release.yml`)
   in the `release` environment, after checking that the run is for the tag
   you pushed. It checks that GitHub verified the tag's signature, that its
   commit is on `main`, the versions and the CI run; pushes, scans, signs
   and tags the image `elixircloud/cloud-registry-ui:X.Y.Z` (or
   `<DOCKERHUB_ORG>/cloud-registry-ui:X.Y.Z`) (`Release image`), and then,
   without another approval, creates the GitHub release (`Publish
   release`): the curated notes of the tagged commit, then GitHub's
   generated notes under `## Commits` (without their `## What's Changed`
   header, with "New Contributors"), and GitHub's `**Full Changelog**` line
   last; versions below 1.0.0 and `-alpha`, `-beta` and `-rc` versions are
   pre-releases. Releases are not edited afterwards: fix mistakes in the
   notes of the next release. If a job fails, use "Re-run failed jobs", not
   "Re-run all jobs": once the image is tagged, a new attempt of all jobs
   stops at the existing tag and can't finish the release, and once the
   GitHub release exists, `prepare` fails; a re-run of `Publish release`
   passes without changes if an earlier attempt created the release after
   all. `prepare` can't see draft releases and `Publish release` fails on
   them, so delete any draft of the tag before you push the tag. If
   `prepare` fails because CI hasn't finished for the commit, re-run the
   workflow once it passed.

The repository needs, once: an environment `release` with a required
reviewer, deployments limited to `v*` tags, and the Docker Hub secrets
`DOCKERHUB_LOGIN` and `DOCKERHUB_TOKEN` (allowed to push
`elixircloud/cloud-registry-ui`; create that repository on Docker Hub,
public, before the first release), only in that environment, not as
repository secrets; optionally the variable `DOCKERHUB_ORG` for another
Docker Hub organization; a ruleset for `dev` that requires the check `CI
passed` (the gate job of `ci.yml`); a ruleset for `main` that lets only
maintainers update it (hosting projects may deploy it)
and protects it against non-fast-forward pushes; a ruleset that lets only maintainers create `v*`
tags and keeps them from being moved or deleted; and immutable releases.
Tags and published releases and images can't be changed: if a release
fails after its tag was pushed and re-running its failed jobs doesn't help,
release the next patch version (with its own release-prep pull request).

After a release, the workflow `Scan` (`.github/workflows/scan.yml`) scans
the image of the latest release (or, before the first stable release, of
the newest pre-release) every Monday, and can be run by hand. It uploads
the fixable findings to code scanning and a full report as a workflow
artifact, and fails on fixable critical and high vulnerabilities: release a
patch version with the fix.

## Reporting Issues

When creating an issue, please include:
- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if helpful)
- Environment details (OS, version, etc.)



## Style Guidelines

- Follow existing project structure
- Keep functions small and focused
- Add comments where necessary
- Use meaningful variable names



## Thank You

Your contributions help make this project better for everyone!
