# Upgrading

## Updating a deployment

1. Pick the release that matches your registry's major and minor version
   (see [Compatibility](index.md#compatibility)). When you upgrade the
   registry to a new minor version, upgrade the app with it.
2. Read its release notes on
   [GitHub](https://github.com/elixir-cloud-aai/cloud-registry-ui/releases),
   and the changes below, for settings to add or change.
3. [Verify the image](deployment.md#verifying-images), update the settings
   if needed, and replace the container with one of the new image.

The app keeps no data of its own: everything is stored in the registry, so
the app can be replaced at any time. Users who are logged in keep their
session (it is kept in cookies), unless the release notes say otherwise.
Logins that are in progress during the update may fail; users then log in
again.

## 1.0.0-rc1

Upgrade the registry to cloud-registry 1.0.0-rc1 together with the app
(see [Compatibility](index.md#compatibility)). It brings two features that
the app uses once the registry has them, **without any setting to change in
the app**:

- **Invitations:** owners invite users to services by link (see [Inviting
  by link](../user-guide/access.md#inviting-by-link) and [Accepting an
  invitation](../user-guide/invitations.md)). Their expiry and limits, and
  what the registry shows of those who accepted, are the registry's
  settings.
- **Limit of services per user:** the registry's setting
  `custom.access_control.max_services_per_user` (50 by default; 0 allows
  only admins to register services) is published in its service info, and
  the app reports it when a registration is refused (see [Limit on
  registered services](../user-guide/registering.md#limit-on-registered-services)).
  Check that the default suits your users before the upgrade.

With registries older than 1.0.0-rc1, the app keeps working: it reports
that the registry has no invitations, and there is no limit.

## Changes since unreleased versions

These changes apply to deployments of earlier, unreleased versions, e.g.
built from the repository.

### Settings at start instead of build arguments

Before, the `NEXT_PUBLIC_*` settings were build arguments of the Docker
image. Now, all settings are read when the app starts, and one image serves
any deployment. Existing deployments must pass them with `docker run` now
(see [Docker](deployment.md#docker)): `docker build --build-arg
NEXT_PUBLIC_*` only prints a warning, and new images no longer hold them in
their history. The names of the settings are unchanged, so `.env` files
and Vercel projects keep working.

### Login providers instead of `LS_LOGIN_URL` and `OIDC_*`

Earlier versions supported only LS Login. Replace these variables:

| Before               | Now                                                           |
| -------------------- | ------------------------------------------------------------- |
| `LS_LOGIN_URL`       | `issuer` of the provider: `LS_LOGIN_URL` followed by `/oidc/` |
| `OIDC_CLIENT_ID`     | `clientId` of the provider                                    |
| `OIDC_CLIENT_SECRET` | `clientSecret` of the provider                                |
| `OIDC_REDIRECT_URI`  | `LOGIN_REDIRECT_URI` (same value)                             |

Use the [LS Login example](login.md), with `"scopes"` as shown to keep
requesting the same scopes. Users who are logged in stay logged in. The app
stops with a message if it finds the old variables without
`LOGIN_PROVIDERS`. On Vercel, change the project's environment variables
before deploying this version: the build fails if the old ones are set
without `LOGIN_PROVIDERS`.

### Admin mode

With cloud-registry 0.6.0 and later, admins act as admins only in admin
mode, which they switch on in the app (see [Admins and admin
mode](admins.md#admin-mode)). All releases of the app support it; builds
from before admin mode was added don't send the admin role, so their
admins can't act as admins with such a registry. Replace them with a
release.
