# Contributing Guide

First off, thank you for taking the time to contribute.
We welcome contributions of all kinds—bug fixes, new features, documentation, and ideas.



## Table of Contents

* [Ways to Contribute](#ways-to-contribute)
* [Getting Started](#getting-started)
* [Development Workflow](#development-workflow)
* [Pull Request Process](#pull-request-process)
* [Reporting Issues](#reporting-issues)
* [Style Guidelines](#style-guidelines)



## Ways to Contribute

You can contribute in several ways:

* Reporting bugs
* Suggesting features
* Improving documentation
* Submitting code fixes or enhancements
* Sharing ideas and feedback



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

* `feat/add-login`
* `fix/navbar-bug`
* `docs/update-readme`


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




## Reporting Issues

When creating an issue, please include:

* Clear title and description
* Steps to reproduce
* Expected vs actual behavior
* Screenshots (if helpful)
* Environment details (OS, version, etc.)



## Style Guidelines

* Follow existing project structure
* Keep functions small and focused
* Add comments where necessary
* Use meaningful variable names



## Thank You

Your contributions help make this project better for everyone!
