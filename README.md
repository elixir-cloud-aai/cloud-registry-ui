# ELIXIR Cloud Registry UI

Web frontend for the ELIXIR Cloud service registry ([cloud-registry](https://github.com/elixir-cloud-aai/cloud-registry)), providing a user interface for browsing and managing GA4GH Service Registry entries: registering and editing services, verifications, access management, service types and their approval.

## Compatibility

UI versions follow the registry in major and minor version: UI 0.5.x works with cloud-registry 0.5.x. Until the first release of the UI, the `ai` branch goes with cloud-registry 0.5.0.

## Installation

### Requirements

- [Git](https://git-scm.com/)
- [Bun 1.3+](https://bun.com/)
- [Docker](https://www.docker.com/)
- A cloud-registry deployment (see [Compatibility](#compatibility)) and a login provider, e.g. [LS Login](https://lifescience-ri.eu/ls-login/) (see [Login](#login))

### Development

Clone the repository and install dependencies:

```
git clone https://github.com/elixir-cloud-aai/cloud-registry-ui.git
cd cloud-registry-ui
bun install
```

Copy `.env.example` to `.env` and set at least `NEXT_PUBLIC_CLOUD_REGISTRY_URL`, `LOGIN_PROVIDERS` and `LOGIN_REDIRECT_URI` (see [Configurations](#configurations)). For a local server, the redirect URI is `http://localhost:3000/auth/api/callback`, and it must be registered with the login provider.

Start the development server:

```
bun run dev
```

The app runs at http://localhost:3000.

### Docker

The image is built with the settings that are read at build time (`NEXT_PUBLIC_*`, see [Configurations](#configurations)). Pass them as build arguments, at least `NEXT_PUBLIC_CLOUD_REGISTRY_URL` (the build fails without it), e.g.:

```
docker build -t cloud-registry-ui \
  --build-arg NEXT_PUBLIC_CLOUD_REGISTRY_URL=https://registry.example.org/ga4gh/registry/v1 \
  --build-arg NEXT_PUBLIC_APP_TITLE="My Cloud Registry" \
  .
```

`docker build` reads only the settings passed with `--build-arg`: not `.env` files, nor variables exported in the shell (`--build-arg NAME`, without a value, passes the shell's value).

`.dockerignore` lets only the sources and build files into the build (an allow list), without `.env*` files, keys or credentials, so local settings and secrets outside the sources can't reach the build, its cache or the image. Build arguments, however, are stored in the image's history (`docker history`): pass only the `NEXT_PUBLIC_*` settings with them, which are public anyway, never the login settings.

Pass the login settings (`LOGIN_PROVIDERS` and `LOGIN_REDIRECT_URI`, see [Login](#login)), which hold the client secret, when the container starts, e.g. from a file outside the repository, such as `~/cloud-registry-ui/login.env`. `--env-file` takes each line as `NAME=value`, literally: don't quote the values.

```
docker run -p 3000:3000 --env-file ~/cloud-registry-ui/login.env cloud-registry-ui
```

Without the login settings, the container refuses to start. Settings passed with `docker run` don't change the `NEXT_PUBLIC_*` values: those need a new image.

The image holds only the built app: Next's standalone server (`bun server.js`), its static files and `public/`, without sources or development dependencies. It runs as the unprivileged user `bun`, which can write only to `.next/cache`, listens on all IPv4 interfaces (set `LISTEN_HOSTNAME`, e.g. to `::` for IPv6, to change this) and on `PORT` (default: 3000), and reports its health (`docker ps`) by requesting the start page every 30 seconds. Serve it over HTTPS, e.g. behind a reverse proxy: the login cookies are marked `Secure`, and browsers accept them over plain HTTP only on `localhost`.

## Configurations

The app is configured through environment variables. For `bun run dev`, `bun run build` and `bun run start`, copy `.env.example` to `.env` and adjust as needed; for the Docker image, pass them as build arguments and with `docker run` (see [Docker](#docker)).

Most settings are read when the app is built (`bun run build`, `docker build`) and are fixed in the build: change them, then build again. Only the login settings are read when the app starts (`bun run start`, `docker run`). `bun run dev` reads all of them.

| Variable                           | Read at | Default                              | Section               |
| ---------------------------------- | ------- | ------------------------------------ | --------------------- |
| `NEXT_PUBLIC_CLOUD_REGISTRY_URL`   | build   | (none, required)                     | [Registry](#registry) |
| `NEXT_PUBLIC_SERVICE_URL_SCHEMES`  | build   | `https`                              | [Registry](#registry) |
| `NEXT_PUBLIC_SERVICE_ENVIRONMENTS` | build   | `prod,test,dev,staging`              | [Registry](#registry) |
| `NEXT_PUBLIC_APP_TITLE`            | build   | `Cloud Registry`                     | [Branding](#branding) |
| `NEXT_PUBLIC_APP_TITLE_SIZE`       | build   | 24 (one line), what fits (two lines) | [Branding](#branding) |
| `NEXT_PUBLIC_APP_TITLE_FONT`       | build   | Open Sans                            | [Branding](#branding) |
| `NEXT_PUBLIC_APP_LOGO`             | build   | `/elixir-on-cloud-mark.svg`          | [Branding](#branding) |
| `NEXT_PUBLIC_APP_LOGO_DARK`        | build   | `/elixir-on-cloud-mark-night.svg`    | [Branding](#branding) |
| `NEXT_PUBLIC_FOOTER_LOGO`          | build   | `/elixir-on-cloud-lockup.svg`        | [Branding](#branding) |
| `NEXT_PUBLIC_FOOTER_LOGO_DARK`     | build   | `/elixir-on-cloud-lockup-night.svg`  | [Branding](#branding) |
| `NEXT_PUBLIC_FOOTER_START_YEAR`    | build   | (none)                               | [Branding](#branding) |
| `LOGIN_PROVIDERS`                  | start   | (none, required)                     | [Login](#login)       |
| `LOGIN_REDIRECT_URI`               | start   | (none, required)                     | [Login](#login)       |

Invalid titles and environments stop `bun run build` and `bun run dev`, and invalid login settings stop `bun run start` and `bun run dev`, with a message that names the setting.

### Registry

Set `NEXT_PUBLIC_CLOUD_REGISTRY_URL` to the registry's API, including the base path, e.g. `https://registry.example.org/ga4gh/registry/v1`. Browsers call the API directly, so it must accept cross-origin requests from the app's address: the registry allows any origin by default (FOCA's `security.cors`).

Set `NEXT_PUBLIC_SERVICE_URL_SCHEMES` to `http,https` if the registry also allows `http` service URLs (`custom.endpoints.services.url_schemes`; default: `https`).

Set `NEXT_PUBLIC_SERVICE_ENVIRONMENTS` to the environments that the registry allows (`custom.endpoints.services.environments`), comma-separated (default, also if empty: `prod,test,dev,staging`). The edit form offers and accepts only these values, also for services that already have another one (the registry checks them on every change), and the environment filter lists those in use first, in this order. The create form offers only the four default values for now (see [Known gaps](#known-gaps)). Set it to `*` if the registry allows any environment (`[]`): the edit form then takes any text. Each value may have at most 256 characters, and `*` can't be combined with other values.

The app follows the registry's other settings, such as who may add service types (`custom.access_control.service_types`) and who is an admin, through `GET /me`: there is nothing to set for them in the app.

### Branding

All optional; read at build time. Logos given as paths must be in `public/` when the app is built.

| Variable                        | Default                              | Description                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_TITLE`         | `Cloud Registry`                     | Title at the top of the sidebar and of the browser tab; at most two lines of at most 24 characters, broken at spaces                                                                                                                                                                             |
| `NEXT_PUBLIC_APP_TITLE_SIZE`    | 24 (one line), what fits (two lines) | Largest font size of the sidebar title, in pixels; can only lower the default (larger values are capped at 24 px for one line and at what fits for two, about 16 px)                                                                                                                              |
| `NEXT_PUBLIC_APP_TITLE_FONT`    | Open Sans                            | CSS `font-family` of the sidebar title, e.g. `Georgia, serif`; other web fonts must be loaded by the page                                                                                                                                                                                         |
| `NEXT_PUBLIC_APP_LOGO`          | `/elixir-on-cloud-mark.svg`          | Logo next to the title (square); a path in `public/` or a URL                                                                                                                                                                                                                                     |
| `NEXT_PUBLIC_APP_LOGO_DARK`     | `/elixir-on-cloud-mark-night.svg`    | `_DARK` = the logo shown in the dark colour scheme, i.e. a light-coloured logo for a dark background; the default applies only with the default `NEXT_PUBLIC_APP_LOGO`: a custom `NEXT_PUBLIC_APP_LOGO` without `_DARK` is shown in both colour schemes, on a white backing in the dark one       |
| `NEXT_PUBLIC_FOOTER_LOGO`       | `/elixir-on-cloud-lockup.svg`        | Logo at the bottom of the sidebar, right of the copyright (40 px high); a path in `public/` or a URL                                                                                                                                                                                              |
| `NEXT_PUBLIC_FOOTER_LOGO_DARK`  | `/elixir-on-cloud-lockup-night.svg`  | `_DARK` = the logo shown in the dark colour scheme, i.e. a light-coloured logo for a dark background; the default applies only with the default `NEXT_PUBLIC_FOOTER_LOGO`: a custom `NEXT_PUBLIC_FOOTER_LOGO` without `_DARK` is shown in both colour schemes, on a white backing in the dark one |
| `NEXT_PUBLIC_FOOTER_START_YEAR` | (none)                               | First year of the copyright line: `© START – CURRENT`, else `© CURRENT`                                                                                                                                                                                                                           |

### Login

Users log in with one of the login providers that you configure (OpenID Connect, authorization code flow). The app reads these settings when the server starts and refuses to start without at least one valid provider. They are read at runtime, so `docker run -e` and `--env-file` work, and they stay on the server: client secrets never reach the browser or the image (pass them with `docker run`, see [Docker](#docker)).

| Variable             | Required | Description                                                                                  |
| -------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `LOGIN_PROVIDERS`    | yes      | Login providers as a JSON list (see below)                                                   |
| `LOGIN_REDIRECT_URI` | yes      | URL of the app's `/auth/api/callback`, e.g. `https://registry.example.org/auth/api/callback` |

Each provider has these fields:

| Field          | Required | Description                                                                          |
| -------------- | -------- | ------------------------------------------------------------------------------------ |
| `id`           | yes      | Unique ID, `a-z`, `0-9` and `-` only, e.g. `ls-login`                                |
| `name`         | yes      | Name on the login page                                                               |
| `logo`         | yes      | Logo on the login page; a URL, or a path in `public/` (built into the image)         |
| `issuer`       | yes      | Issuer URL, as in its `/.well-known/openid-configuration`, which lists the endpoints |
| `clientId`     | yes      | Client ID registered with the provider                                               |
| `clientSecret` | yes      | Client secret                                                                        |
| `scopes`       | no       | Default: `["openid", "profile", "email"]`; add `eduperson_entitlement` for LS Login  |

Example for [LS Login](https://lifescience-ri.eu/ls-login/), whose logo is in `public/`:

```
LOGIN_PROVIDERS=[{"id": "ls-login", "name": "LS Login", "logo": "/ls-login-grey-wide.jpg", "issuer": "https://login.aai.lifescience-ri.eu/oidc/", "clientId": "<client ID>", "clientSecret": "<client secret>", "scopes": ["openid", "profile", "email", "eduperson_entitlement"]}]
LOGIN_REDIRECT_URI=https://registry.example.org/auth/api/callback
```

The login page lists the providers, also when there is only one, so that logging out doesn't log users straight back in. Restart the app after changing the providers.

**Configure one provider for now:** the registry must trust each provider's issuer, and user IDs from different providers can clash until the registry namespaces them by issuer ([elixir-cloud-aai/foca#503](https://github.com/elixir-cloud-aai/foca/issues/503)). All providers also share one redirect URI, so the app can't yet tell which provider answered a login; don't combine trusted and untrusted providers.

#### Registering the app with LS Login

Register the app with [LS Login](https://lifescience-ri.eu/ls-login/) as a service (an OpenID Connect client):

- **Flow:** authorization code, with a client secret.
- **Redirect URI:** the value of `LOGIN_REDIRECT_URI`, e.g. `https://registry.example.org/auth/api/callback`. Use a separate client for local development, with `http://localhost:3000/auth/api/callback`.
- **Scopes:** `openid`, `profile`, `email` and `eduperson_entitlement`. LS Login releases the groups (`eduperson_entitlement`), which the registry needs to recognise admins, only with this scope, and only via user info.

Put the client ID and secret in `LOGIN_PROVIDERS` (see the example above), and keep its `scopes`: without them, the app requests only the default scopes, and the registry doesn't recognise admins. The app sends the user's access token to the registry, never the ID token.

#### Registry settings for the app

The registry accepts the app's tokens only if it is configured for them (see the registry's [configuration docs](https://github.com/elixir-cloud-aai/cloud-registry/blob/dev/docs/configuration.md#deployment-configuration)). For LS Login, in a config overlay (with the registry's Helm chart, in its `config` value):

```yaml
security:
    auth:
        issuers:
            - https://login.aai.lifescience-ri.eu/oidc/
        audience:
            - <client ID of the app>
        userinfo_claims:
            - eduperson_entitlement
            - name
    access_control:
        claim_groups: eduperson_entitlement
        group_mapping:
            "<admin group, a value of eduperson_entitlement>": admin
```

- `issuers` must contain the provider's issuer, exactly as in `LOGIN_PROVIDERS`.
- `audience` must contain the app's client ID; otherwise, all requests that need a login fail with `401`.
- `userinfo_claims` lets the registry read the groups and names that LS Login doesn't put in access tokens.

#### Migrating from `LS_LOGIN_URL` and `OIDC_*`

Earlier versions supported only LS Login. Replace these variables:

| Before               | Now                                                           |
| -------------------- | ------------------------------------------------------------- |
| `LS_LOGIN_URL`       | `issuer` of the provider: `LS_LOGIN_URL` followed by `/oidc/` |
| `OIDC_CLIENT_ID`     | `clientId` of the provider                                    |
| `OIDC_CLIENT_SECRET` | `clientSecret` of the provider                                |
| `OIDC_REDIRECT_URI`  | `LOGIN_REDIRECT_URI` (same value)                             |

Use the LS Login example above, with `"scopes"` as shown to keep requesting the same scopes. Users who are logged in stay logged in.

## Known gaps

The form for registering services comes from [Cloud Components](https://github.com/elixir-cloud-aai/cloud-components) (`@elixir-cloud/cloud-registry`). Until it supports the registry's newer features, the app works around these gaps:

- **Environments:** the form offers only `prod`, `test`, `dev` and `staging`; the app rejects other values before sending the request ([elixir-cloud-aai/cloud-components#461](https://github.com/elixir-cloud-aai/cloud-components/issues/461)).
- **Service types:** the form asks for the type as free text, not as a choice from the registered types ([elixir-cloud-aai/cloud-components#456](https://github.com/elixir-cloud-aai/cloud-components/issues/456)), and doesn't say when a new type will be pending until an admin approves it (the Service Types page and the edit form do).
- **Custom service ID:** the form always shows the field, but only admins may choose an ID; the app rejects it for others before sending the request ([elixir-cloud-aai/cloud-components#447](https://github.com/elixir-cloud-aai/cloud-components/issues/447)).
- **Validation:** the form only checks required fields, so some inputs fail with the registry's error message after sending ([elixir-cloud-aai/cloud-components#453](https://github.com/elixir-cloud-aai/cloud-components/issues/453)).
- **Layout:** contact and documentation URLs are under "Advanced Configuration" ([elixir-cloud-aai/cloud-components#457](https://github.com/elixir-cloud-aai/cloud-components/issues/457)).

## Contributing

This project is a community effort and lives off your contributions, be it in the form of bug reports, feature requests, discussions, or fixes and other code changes. Please refer to our project's contribution guidelines if you are interested in contributing.
