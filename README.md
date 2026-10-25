# ELIXIR Cloud Registry UI

Web frontend for the ELIXIR Cloud service registry, providing a user interface for browsing and managing GA4GH Service Registry entries.

## Installation

### Requirements

- [Git](https://git-scm.com/)
- [Bun 1.3+](https://bun.com/)
- [Docker](https://www.docker.com/)

### Development

Clone the repository and install dependencies:

```
git clone https://github.com/elixir-cloud-aai/cloud-registry-ui.git
cd cloud-registry-ui
bun install
```

Start the development server:
```
bun run dev
```


### Docker

```
docker build -t cloud-registry-ui .
docker run -p 3000:3000 --env-file .env cloud-registry-ui
```

## Configurations

The app is configured through environment variables. Copy .env.example to .env and adjust as needed.

Set `NEXT_PUBLIC_SERVICE_URL_SCHEMES` to `http,https` if the registry also allows `http` service URLs (`custom.endpoints.services.url_schemes`; default: `https`). Like all `NEXT_PUBLIC_*` variables, it must be set when the app is built.

Branding (all optional). These are build-time values: set them in `.env` before `bun run build` or `docker build` (`docker build` does not pass on the shell environment); `docker run -e` does not change a built image.

| Variable                        | Default                       | Description                                                                  |
| ------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_TITLE`         | `Cloud Registry`              | Title at the top of the sidebar and of the browser tab                       |
| `NEXT_PUBLIC_APP_LOGO`          | `/elixir-on-cloud-mark.svg`   | Logo next to the title (square); a path in `public/` or a URL                |
| `NEXT_PUBLIC_FOOTER_LOGO`       | `/elixir-on-cloud-lockup.svg` | Logo at the bottom of the sidebar (full width); a path in `public/` or a URL |
| `NEXT_PUBLIC_FOOTER_START_YEAR` | (none)                        | First year of the copyright line: `© START – CURRENT`, else `© CURRENT`      |


### Login

Users log in with one of the login providers that you configure (OpenID Connect, authorization code flow). The app reads these settings when the server starts and refuses to start without at least one valid provider. They are read at runtime, so `docker run -e` works, and they stay on the server: client secrets never reach the browser.

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
| `scopes`       | no       | Scopes to request (default: `["openid", "profile", "email"]`)                        |

Example for [LS Login](https://lifescience-ri.eu/ls-login/), whose logo is in `public/`:

```
LOGIN_PROVIDERS=[{"id": "ls-login", "name": "LS Login", "logo": "/ls-login-grey-wide.jpg", "issuer": "https://login.aai.lifescience-ri.eu/oidc/", "clientId": "<client ID>", "clientSecret": "<client secret>", "scopes": ["openid", "profile", "email", "eduperson_entitlement"]}]
LOGIN_REDIRECT_URI=https://registry.example.org/auth/api/callback
```

The login page lists the providers, also when there is only one, so that logging out doesn't log users straight back in. Restart the app after changing the providers.

**Configure one provider for now:** the registry must trust each provider's issuer, and user IDs from different providers can clash until the registry namespaces them by issuer ([elixir-cloud-aai/foca#503](https://github.com/elixir-cloud-aai/foca/issues/503)). All providers also share one redirect URI, so the app can't yet tell which provider answered a login; don't combine trusted and untrusted providers.

#### Migrating from `LS_LOGIN_URL` and `OIDC_*`

Earlier versions supported only LS Login. Replace these variables:

| Before               | Now                                                           |
| -------------------- | ------------------------------------------------------------- |
| `LS_LOGIN_URL`       | `issuer` of the provider: `LS_LOGIN_URL` followed by `/oidc/` |
| `OIDC_CLIENT_ID`     | `clientId` of the provider                                    |
| `OIDC_CLIENT_SECRET` | `clientSecret` of the provider                                |
| `OIDC_REDIRECT_URI`  | `LOGIN_REDIRECT_URI` (same value)                             |

Use the LS Login example above, with `"scopes"` as shown to keep requesting the same scopes. Users who are logged in stay logged in.

## Contributing

This project is a community effort and lives off your contributions, be it in the form of bug reports, feature requests, discussions, or fixes and other code changes. Please refer to our project's contribution guidelines if you are interested in contributing.
