# Development

## Requirements

- [Git](https://git-scm.com/)
- [Bun 1.3+](https://bun.com/)
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

End-to-end tests (`e2e/`, Playwright, in Chromium and Firefox) need a
registry and a login provider: `e2e/stack/compose.yaml` runs cloud-registry,
MongoDB and a mock OpenID Connect provider on ports 8180 and 8190. The tests
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
test changes.

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
  NEXT_PUBLIC_SERVICE_URL_SCHEMES=http,https \
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
