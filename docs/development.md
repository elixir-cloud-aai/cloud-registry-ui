# Development

## Requirements

- [Git](https://git-scm.com/)
- [Bun](https://bun.com/), in the version of `packageManager` in
  `package.json`
- [Node.js 22+](https://nodejs.org/), for the tests
- [Docker](https://www.docker.com/)
- A cloud-registry deployment (see
  [Compatibility](operator-guide/index.md#compatibility)) and a login
  provider, e.g. [LS Login](https://lifescience-ri.eu/ls-login/) (see
  [Login](operator-guide/login.md)); for development, the stack of the
  end-to-end tests has both (see [Tests](#tests))
- [Python 3.13](https://www.python.org/), for the docs

## Setup

Clone the repository and install dependencies:

```
git clone https://github.com/elixir-cloud-aai/cloud-registry-ui.git
cd cloud-registry-ui
bun install
```

Copy `.env.example` to `.env` and set at least
`NEXT_PUBLIC_CLOUD_REGISTRY_URL`, `LOGIN_PROVIDERS` and `LOGIN_REDIRECT_URI`
(see [Configuration](operator-guide/configuration.md)). For a local server,
the redirect URI is `http://localhost:3000/auth/api/callback`, and it must
be registered with the login provider.

Start the development server:

```
bun run dev
```

The app runs at http://localhost:3000. To run a production build locally,
run `bun run build` and `bun run start`.

## Lint

[Biome](https://biomejs.dev/) (`biome.json`) checks the lint rules, the
formatting and the order of imports of the code; Markdown, YAML and CFF
files are left out. CI's `lint` job runs it:

```
bun run lint
```

`bun x biome check --write` fixes what Biome can fix safely, and
`bun run format` formats only. Where a rule doesn't fit, suppress it on
the line with a reason, e.g.
`// biome-ignore lint/suspicious/noArrayIndexKey: placeholders, which never change order`.

## Tests

The tests need [Node.js 22+](https://nodejs.org/) next to Bun: Vitest and
Playwright don't run on Bun's runtime. CI runs all of them
(`.github/workflows/ci.yml`).

Unit and route handler tests (`src/**/*.test.ts`, Vitest), with coverage,
which must stay at 100% for `src/lib`, the auth routes and the form, filter
and access helpers:

```
npm run test:coverage
```

The report goes to `coverage/` (`lcov.info` for
[Codecov](https://app.codecov.io/gh/elixir-cloud-aai/cloud-registry-ui),
where CI uploads it; `codecov.yml` requires full coverage of the code and of
the changes of each pull request).

End-to-end tests (`e2e/`, Playwright, in Chromium and Firefox) need a
registry and a login provider: `e2e/stack/compose.yaml` runs cloud-registry,
MongoDB, a mock OpenID Connect provider and a service with service info to
import (`e2e/stack/service-info.py`) on ports 8180, 8190 and 8191. The tests
build and start the app on port 3100, log in as test users through the mock
provider (`e2e/fixtures.ts`), and fail on Content Security Policy
violations, page errors, logged errors and failed requests of the app's
pages. The browsers must resolve `oidc.localhost` to the local machine, as
Chromium and Firefox do; so must the app, which most systems do (otherwise
add `127.0.0.1 oidc.localhost` to `/etc/hosts`):

```
docker compose -f e2e/stack/compose.yaml up -d --wait
npx playwright install chromium firefox
npm run test:e2e
docker compose -f e2e/stack/compose.yaml down
```

`npm run test:e2e` reuses an app already running on port 3100; stop it to
test changes. CI fails a test that passes only on its retry, as such flaky
tests hide bugs; requests that are logged as errors when a page is left
are a common cause (see [Loaders](#loaders)).

Before a test leaves a page, e.g. by `page.goto()`, a reload or a logout,
it waits until the page's reads of the registry have finished:
`waitForReads()` of `e2e/fixtures.ts` around what starts them (or
`openPage()` for `page.goto()`), with the responses of the reads that the
page starts last, e.g. `isApprovalsRead` for the lists of users who are
logged in, `serviceReads()` for a service's page and `editFormReads()`
for its edit form. Not `waitForLoadState("networkidle")`, which may return
before the app has started its reads. At the end of a test, the fixtures
wait for the reads still running before they check for problems. Selects
of the app are opened with `openList()`, which waits until their options
take clicks.

`E2E_BASE_URL` points the tests to an app that runs already, e.g.
`http://localhost:3100`, instead of building and starting one; it must
have the settings of the tests (`playwright.config.ts`). The image runs
the app as it ships: the standalone server on Bun, where `npm run test:e2e`
runs `next start` on Node.js. The service `app` of the stack (profile
`image`) runs the image `cloud-registry-ui:ci`, or the one of
`E2E_APP_IMAGE`, with these settings on port 3100. CI's `e2e-image` job
runs the login and services tests against the image that the `image` job
builds:

```
docker build -t cloud-registry-ui:ci .
docker compose -f e2e/stack/compose.yaml --profile image up -d --wait
E2E_BASE_URL=http://localhost:3100 npx playwright test e2e/auth.spec.ts e2e/services.spec.ts
docker compose -f e2e/stack/compose.yaml --profile image down
```

The app's container uses the host's network, as Docker Engine on Linux
has it; Docker Desktop needs its host networking turned on. As above, the
browsers must resolve `oidc.localhost` to the local machine.

## Loaders

Pages and components that load from the registry abort their requests
when they unmount or load anew: `useLatestRequest()` for loaders that can
load again (each request aborts the one before), or an `AbortController`
in the effect for those that load once. They pass its signal to the
registry's client, whose reads take `{ signal }` (`ReadOptions`; new reads
take it, too), and neither log nor show aborted requests (`isAborted()` in
`src/lib/abort.ts`), also those that browsers abort when they leave a
page. Otherwise every navigation during loading logs errors, and the
end-to-end tests, which fail on logged errors, become flaky.

## Cloud Components

The create form of Cloud Components has no properties for its values, so the
import of service info sets and reads its internal state (`formData`,
`typeChoice`, `serviceTypes`). `src/lib/service-import.ts` is the one place that
knows this state, and `e2e/service-import.spec.ts` fails if an update of Cloud
Components changes it. Move to properties once the component has them.

## Dependency updates

Dependabot (`.github/dependabot.yml`) opens grouped pull requests against
`dev` each month, with commit messages starting with
`build(deps)`, for the Bun dependencies, the docs packages, the actions and
the Docker image. Cloud Components (`@elixir-cloud/*`), prereleases pinned
to exact versions, come in pull requests of their own, as their updates
may break the create form (see [Cloud Components](#cloud-components)).
`@types/node` stays on the major version of the oldest Node.js the tests
support (22). `@playwright/test` is left out: bump it by hand, together
with the Playwright image of the `e2e` and `e2e-image` jobs
(`.github/workflows/ci.yml`).
Codecov uploads use the organisation secret `CODECOV_TOKEN`.

`packageManager` in `package.json` is the one source of the Bun version:
the workflows read it (`bun-version-file`), and the Bun images of the
`Dockerfile`, pinned by digest, must have the same version, which the
`lint` job checks. Pull requests that bump the Bun image must also bump
`packageManager`, and the other way round (with the image's digest, e.g.
from `docker buildx imagetools inspect oven/bun:<version>`): Dependabot's
pull requests for the Bun image fail the `lint` job until someone adds a
commit that bumps `packageManager`.

## Dependency audit

The `audit` job of CI fails on high and critical advisories in the
production dependencies, because Next.js bundles them into the app, where
image scanners can't see them. Run it locally with:

```
bun audit --prod --audit-level=high
```

The job checks npm's advisory database as it is when the job runs, so a
newly published advisory fails it on every pull request and push, without a
change to the code. Fix it by updating the package (`bun update <package>`
for a direct dependency, otherwise the dependency that pulls it in).
`--prod` also reports dev-only copies of packages that the production
dependencies use (for example an old copy pulled in by a CLI): update the
dev dependency that brings the copy. If no fixed version exists, ignoring
the advisory (`--ignore <CVE>` in the job) leaves a deliberate gap in the
check: agree on it in a pull request that says why.

## Image scan

The `scan` job of CI scans the Docker image built by the `image` job with
[Trivy](https://trivy.dev/) (the shared action
[`scan-image`](https://github.com/elixir-cloud-aai/.github/tree/main/actions/scan-image)
of `elixir-cloud-aai/.github`, pinned to the commit of a release), with
the flags of the release scan: it fails on critical and high
vulnerabilities that have a fix, and uploads them to code scanning. The
workflow `Scan` (`.github/workflows/scan.yml`) scans the image of the
latest release every Monday in the same way, with a full report as a
workflow artifact. Fix a finding by updating the base image of the `Dockerfile` (the Bun image), or
accept it in `.trivyignore.yaml`, with a reason and an expiry date. To scan
locally as CI does:

```
docker build -t cloud-registry-ui:scan .
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$PWD/.trivyignore.yaml:/trivyignore.yaml:ro" aquasec/trivy:0.75.0 \
    image --ignorefile /trivyignore.yaml --ignore-unfixed \
    --severity CRITICAL,HIGH --exit-code 1 cloud-registry-ui:scan
```

See "Releasing" in `CONTRIBUTING.md` for what the scans mean for releases.

## Docs

The docs (`docs/`) are built with [MkDocs](https://www.mkdocs.org/) and the
[Material theme](https://squidfunk.github.io/mkdocs-material/), and
published on [Read the Docs](https://cloud-registry-ui.readthedocs.io/)
(`.readthedocs.yaml`). To build them as CI and Read the Docs do, failing on
warnings such as broken links:

```
python3 -m venv .venv
.venv/bin/pip install -r docs/requirements.txt
.venv/bin/mkdocs build --strict
```

`.venv/bin/mkdocs serve` serves them at http://localhost:8000 and rebuilds
them on changes.

### Screenshots

The screenshots of the user guide (`docs/images/`) show the default
branding. `scripts/docs-screenshots.mjs` takes them again, e.g. after
changes to the pages: with the stack of the end-to-end tests running (see
[Tests](#tests)), build the app and start it with the settings of the
end-to-end tests (`playwright.config.ts`), then run the script.

First move your `.env*` files (except `.env.example`) aside, or use a
clean clone: values set in them when building apply where the commands
don't set them, e.g. a title or logos other than the default branding:

```
docker compose -f e2e/stack/compose.yaml up -d --wait
bun run build
NEXT_PUBLIC_CLOUD_REGISTRY_URL=http://localhost:8180/ga4gh/registry/v1 \
  LOGIN_PROVIDERS='[{"id": "mock", "name": "Mock Login", "logo": "/elixir-on-cloud-mark.svg", "issuer": "http://oidc.localhost:8190/oidc", "clientId": "cloud-registry-ui-e2e", "clientSecret": "e2e-secret"}]' \
  LOGIN_REDIRECT_URI=http://localhost:3100/auth/api/callback \
  bun run start --port 3100 &
until curl -sf http://localhost:3100/auth/login > /dev/null; do sleep 1; done
node scripts/docs-screenshots.mjs
kill %1
docker compose -f e2e/stack/compose.yaml down
```

The script adds example service types and services to the registry if it
lists no services yet, so start with an empty registry (the stack keeps no
data after `down`). `APP_URL`, `REGISTRY_URL` and `LOGIN_NAME` (the
provider's name on the login page) point it to another stack, e.g. one on
other ports. The login page in the docs shows LS Login: for it, start the
app with `"name": "LS Login"` and `"logo": "/ls-login-grey-wide.jpg"`, and
run the script with `LOGIN_NAME="LS Login"`.
