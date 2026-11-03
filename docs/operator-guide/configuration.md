# Configuration

The app is configured through environment variables. For `bun run dev`, `bun run build` and `bun run start`, copy `.env.example` to `.env` and adjust as needed; for the Docker image, pass them with `docker run` (see [Docker](deployment.md#docker)).

The settings are read when the app starts (`bun run start`, `docker run`, `bun run dev`): change them, then restart the app, without building it again. The `NEXT_PUBLIC_*` settings reach the browser, so they are public: put no secrets in them. Values of `NEXT_PUBLIC_*` settings that are set when the app is built (e.g. in `.env` for `bun run build`, or on Vercel) apply where the environment of the started app doesn't set them; the Docker image is built without settings, so this doesn't apply there.

| Variable                           | Required | Section                 |
| ---------------------------------- | -------- | ----------------------- |
| `NEXT_PUBLIC_CLOUD_REGISTRY_URL`   | yes      | [Registry](#registry)   |
| `NEXT_PUBLIC_ACCESS_PAGE_SIZE`     | no       | [Access dialog](#access-dialog) |
| `NEXT_PUBLIC_APP_TITLE`            | no       | [Branding](branding.md) |
| `NEXT_PUBLIC_APP_TITLE_SIZE`       | no       | [Branding](branding.md) |
| `NEXT_PUBLIC_APP_TITLE_FONT`       | no       | [Branding](branding.md) |
| `NEXT_PUBLIC_APP_LOGO`             | no       | [Branding](branding.md) |
| `NEXT_PUBLIC_APP_LOGO_DARK`        | no       | [Branding](branding.md) |
| `NEXT_PUBLIC_FOOTER_LOGO`          | no       | [Branding](branding.md) |
| `NEXT_PUBLIC_FOOTER_LOGO_DARK`     | no       | [Branding](branding.md) |
| `NEXT_PUBLIC_FOOTER_START_YEAR`    | no       | [Branding](branding.md) |
| `LOGIN_PROVIDERS`                  | yes      | [Login](login.md)       |
| `LOGIN_REDIRECT_URI`               | yes      | [Login](login.md)       |

Missing or invalid settings stop the app with a message that names the setting:

- They stop `bun run start`, `docker run` and `bun run dev`; `bun run build` and `docker build` don't need them.
- On Vercel, which deploys what it builds, they also stop the build (`vercel build`, or the build on Vercel's servers), so set them for every environment that builds, Preview included. `vercel pull` can't read sensitive variables: for those, such as `LOGIN_PROVIDERS` with the client secret, `vercel build` only checks that they are set, and checks the others as usual.

The defaults are given in each section. The login settings are described
in [Login](login.md), the branding in [Branding](branding.md).

## Registry

Set `NEXT_PUBLIC_CLOUD_REGISTRY_URL` (required) to the registry's API, including the base path, e.g. `https://registry.example.org/ga4gh/registry/v1`. It must be an absolute `https` URL, or `http` for `localhost` and loopback addresses, without a user, password, query or fragment. Browsers call the API directly, so it must accept cross-origin requests from the app's address: the registry allows any origin by default (FOCA's `security.cors`).

The app's Content Security Policy lets browsers connect only to the app and to this URL's origin, and other sites can't frame the app. Scripts run only with a nonce that changes on every request, so pages are rendered per request and not cached. The policy still allows inline styles (used by components and libraries) and images from any `https` URL (logos). Don't let a proxy in front of the app add a second Content Security Policy: browsers enforce both, and one without the nonce blocks the app's scripts. On Vercel, the toolbar of preview deployments is blocked.

The app follows the registry's rules for registrations, as the registry publishes them in its service info (`registration_rules` of `GET /service-info`, see the registry's [registration rules](https://cloud-registry.readthedocs.io/en/latest/api/#registration-rules)): the edit form offers and accepts only the environments that the registry allows (`custom.endpoints.services.environments`), also for services that already have another one (the registry checks them on every change), or any text if it allows any environment; it accepts only service URLs with the schemes that the registry allows (`custom.endpoints.services.url_schemes`); and the environment filter of the list shows the allowed environments that are in use first, in the registry's order. If the service info can't be read, or the registry publishes no rules (registries older than cloud-registry 0.6.0), the edit form says so, takes any environment and any `http` or `https` service URL, and leaves the checks to the registry, which reports what it refuses when the form is sent. The app follows who may add service types (`custom.access_control.service_types`) and who is an admin through `GET /me`; the service info page shows all of the rules, and the service types page offers adding types to users other than admins only if they may have added unused types (`custom.access_control.max_unused_service_types` isn't `0`), and names the limit in its dialog. There is nothing to set for any of these in the app: change them in the registry, and the app follows without a restart.

The create form (from Cloud Components) reads the environments from the service info itself: it offers those that the registry publishes, and takes any text if they allow any (`[]`); with older registries, it offers the four default values.

The settings `NEXT_PUBLIC_SERVICE_ENVIRONMENTS` and `NEXT_PUBLIC_SERVICE_URL_SCHEMES` of earlier versions are no longer read: if they are set, the app ignores them and logs a warning when it starts (see [Upgrading](upgrading.md#registration-rules-instead-of-settings)).

Admin mode needs no settings in the app either; see [Admins and admin
mode](admins.md).

## Access dialog

`NEXT_PUBLIC_ACCESS_PAGE_SIZE` (default: `5`) sets the entries per page of both tables of the **Manage access** dialog (see [Managing access](../user-guide/access.md#managing-access)): the users and groups with a role, and the open invitations. It must be a whole number of at least 1. With the default, both tabs fit a window of 1366 x 768 pixels without scrolling; with higher values, the dialog may scroll in small windows.
