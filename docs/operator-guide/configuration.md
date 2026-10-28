# Configuration

The app is configured through environment variables. For `bun run dev`, `bun run build` and `bun run start`, copy `.env.example` to `.env` and adjust as needed; for the Docker image, pass them with `docker run` (see [Docker](deployment.md#docker)).

The settings are read when the app starts (`bun run start`, `docker run`, `bun run dev`): change them, then restart the app, without building it again. The `NEXT_PUBLIC_*` settings reach the browser, so they are public: put no secrets in them. Values of `NEXT_PUBLIC_*` settings that are set when the app is built (e.g. in `.env` for `bun run build`, or on Vercel) apply where the environment of the started app doesn't set them; the Docker image is built without settings, so this doesn't apply there.

| Variable                           | Required | Section                 |
| ---------------------------------- | -------- | ----------------------- |
| `NEXT_PUBLIC_CLOUD_REGISTRY_URL`   | yes      | [Registry](#registry)   |
| `NEXT_PUBLIC_SERVICE_URL_SCHEMES`  | no       | [Registry](#registry)   |
| `NEXT_PUBLIC_SERVICE_ENVIRONMENTS` | no       | [Registry](#registry)   |
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

Set `NEXT_PUBLIC_SERVICE_URL_SCHEMES` to the schemes that the registry allows for service URLs (`custom.endpoints.services.url_schemes`, see the registry's [service URL schemes](https://cloud-registry.readthedocs.io/en/latest/configuration/#service-url-schemes)), comma-separated: `https` (default, also if empty), `http` or `http,https`. Other values stop the app.

Set `NEXT_PUBLIC_SERVICE_ENVIRONMENTS` to the environments that the registry allows (`custom.endpoints.services.environments`, see the registry's [service environments](https://cloud-registry.readthedocs.io/en/latest/configuration/#service-environments)), comma-separated (default, also if empty: `prod,test,dev,staging`). The edit form offers and accepts only these values, also for services that already have another one (the registry checks them on every change), and the environment filter lists those in use first, in this order. The create form offers only the four default values for now (see [Known limitations](../user-guide/registering.md#known-limitations)). Set it to `*` if the registry allows any environment (`[]`): the edit form then takes any text. Each value may have at most 256 characters, and `*` can't be combined with other values.

The app follows the registry's other settings, such as who may add service types (`custom.access_control.service_types`) and who is an admin, through `GET /me`: there is nothing to set for them in the app.

Admin mode needs no settings in the app either; see [Admins and admin
mode](admins.md).
