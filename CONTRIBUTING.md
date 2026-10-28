# Contributing Guide

First off, thank you for taking the time to contribute.
We welcome contributions of all kinds—bug fixes, new features, documentation, and ideas.



## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
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
git clone https://github.com/elixir-cloud-aai/cloud-registry-ui.git
cd cloud-registry-ui
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

Always create a new branch for your work:

```bash
git checkout -b feature/short-description
```

Branch naming examples:
- `feat/add-login`
- `fix/navbar-bug`
- `docs/update-readme`


### Commit Guidelines

Please refer to [this article] for more information.(https://github.com/elixir-cloud-aai/elixir-cloud-aai/blob/dev/resources/contributing_guidelines.md#commit-messages).



## Pull Request Process

1. Ensure your branch is up to date:

```bash
git pull upstream main
```

2. Push your changes to the forked repo:

```bash
git push origin your-branch-name
```

3. Open a Pull Request on GitHub




## Releasing

Releases are cut from `main` by the maintainers (see [Compatibility](docs/operator-guide/index.md#compatibility) for the versions):

1. Merge the release's changes into `main`, and let CI pass for that commit.
2. On a branch, set the version in `package.json` and in `CITATION.cff` (`version`; add or update `date-released`), and update the authors in `CITATION.cff`: everyone who committed to the repository, listed by the number of lines they committed, then by the number of their commits. Merge it into `main`.
3. Tag the merge commit with a signed, annotated tag, `vX.Y.Z` (or `vX.Y.Z-alphaN`, `vX.Y.Z-betaN` or `vX.Y.Z-rcN` for a pre-release), and push it: `git tag -s vX.Y.Z -m vX.Y.Z`, then `git push origin vX.Y.Z`.
4. Approve the jobs of the release workflow (`.github/workflows/release.yml`) in the `release` environment, after checking that the run is for the tag you pushed. It checks the tag and the versions, pushes, scans, signs and tags the image `elixircloud/cloud-registry-ui:X.Y.Z` (or `<DOCKERHUB_ORG>/cloud-registry-ui:X.Y.Z`), and publishes the GitHub release with the generated notes; add the curated sections to the notes afterwards. If a job fails, use "Re-run failed jobs", not "Re-run all jobs": once the image is tagged, a new attempt of all jobs stops at the existing tag and can't finish the release.

The repository needs, once: an environment `release` with a required reviewer, deployments limited to `v*` tags, and the Docker Hub secrets `DOCKERHUB_LOGIN` and `DOCKERHUB_TOKEN` (allowed to push `elixircloud/cloud-registry-ui`; create that repository on Docker Hub, public, before the first release), optionally the variable `DOCKERHUB_ORG` for another Docker Hub organization, and a ruleset that lets only maintainers create `v*` tags and keeps them from being moved or deleted. Tags and published images can't be changed: if a release fails after its tag was pushed and re-running its failed jobs doesn't help, release the next patch version.

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
