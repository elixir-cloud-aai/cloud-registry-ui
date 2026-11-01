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

Please refer to [this article] for more information.(https://github.com/elixir-cloud-aai/elixir-cloud-aai/blob/dev/resources/contributing_guidelines.md#commit-messages).



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
   add the release notes as `docs/releases/<version>.md` (intro and grouped
   sections, as in earlier notes) and to the "Releases" section of
   `mkdocs.yml`, set the version in `package.json` and in `CITATION.cff`
   (`version`; add or update `date-released`), and update the authors in
   `CITATION.cff`: everyone who committed to the repository, listed by the
   number of lines they committed, then by the number of their commits.
   Each version, also each pre-release (e.g., `X.Y.Z-rc1`), needs its own
   such change. Merge it.
2. Wait until CI has passed for the push to `dev` of the commit that the
   merge created on `dev` (`<sha>`, not the head of the pull request): the
   release workflow requires a successful CI run for a push of the tagged
   commit (runs for pull requests test merge commits, not the commit
   itself).
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
       runs="$(gh api "repos/elixir-cloud-aai/cloud-registry-ui/actions/workflows/ci.yml/runs?head_sha=${sha}&branch=dev&event=push&status=success&per_page=1" --jq .total_count)"
       (( runs >= 1 )) || { echo "No successful CI run for the push of ${sha} to dev"; exit 1; }
       git merge-base --is-ancestor origin/main "${sha}" || { echo "main can't be fast-forwarded to ${sha}"; exit 1; }
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

   Moving `main` also deploys it to Vercel production
   (`.github/workflows/deploy-prod.yml`), also for pre-releases.
4. Approve the jobs of the release workflow (`.github/workflows/release.yml`)
   in the `release` environment, after checking that the run is for the tag
   you pushed. It checks that GitHub verified the tag's signature, that its
   commit is on `main`, the versions and the CI run; pushes, scans, signs
   and tags the image `elixircloud/cloud-registry-ui:X.Y.Z` (or
   `<DOCKERHUB_ORG>/cloud-registry-ui:X.Y.Z`), and publishes the GitHub
   release with the generated notes; add the curated sections to the notes
   afterwards. If a job fails, use "Re-run failed jobs", not "Re-run all
   jobs": once the image is tagged, a new attempt of all jobs stops at the
   existing tag and can't finish the release. If `prepare` fails because CI
   hasn't finished for the commit, re-run the workflow once it passed.

The repository needs, once: an environment `release` with a required
reviewer, deployments limited to `v*` tags, and the Docker Hub secrets
`DOCKERHUB_LOGIN` and `DOCKERHUB_TOKEN` (allowed to push
`elixircloud/cloud-registry-ui`; create that repository on Docker Hub,
public, before the first release), only in that environment, not as
repository secrets; optionally the variable `DOCKERHUB_ORG` for another
Docker Hub organization; a ruleset for `dev` that requires the check `CI
passed` (the gate job of `ci.yml`); a ruleset for `main` that lets only
maintainers update it (every push to `main` deploys to Vercel production)
and protects it against non-fast-forward pushes; a ruleset that lets only maintainers create `v*`
tags and keeps them from being moved or deleted; and immutable releases.
Tags and published releases and images can't be changed: if a release
fails after its tag was pushed and re-running its failed jobs doesn't help,
release the next patch version (with its own release-prep pull request).

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
