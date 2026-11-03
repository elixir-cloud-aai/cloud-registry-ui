# Operator guide

This guide is for people who deploy and run the Cloud Registry UI for a
registry: the Docker image, its settings, login, branding, admins and
upgrading. For using the app, see the [User guide](../user-guide/index.md).

The app is a [Next.js](https://nextjs.org/) web app. Browsers talk to the
registry directly; the app's server handles the login and serves the
pages. A deployment needs:

- a [Cloud Registry](https://cloud-registry.readthedocs.io/en/latest/)
  deployment of a compatible version (see [Compatibility](#compatibility));
- a login provider (OpenID Connect) that the registry trusts, e.g. [LS
  Login](https://lifescience-ri.eu/ls-login/), with the app registered as a
  client (see [Login](login.md));
- a host for the app's container, served over HTTPS (see
  [Deployment](deployment.md)).

## Quick start

1. Register the app with your login provider, with the redirect URI
   `https://<app address>/auth/api/callback` (see [Login](login.md)).
2. Configure the registry to accept the app's tokens (see [Registry
   settings for the app](login.md#registry-settings-for-the-app)).
3. Write the settings to a file outside the repository, e.g.
   `~/cloud-registry-ui/settings.env` (see [Configuration](configuration.md)):

    ```
    NEXT_PUBLIC_CLOUD_REGISTRY_URL=https://registry.example.org/ga4gh/registry/v1
    LOGIN_PROVIDERS=<login providers, see Login>
    LOGIN_REDIRECT_URI=https://app.example.org/auth/api/callback
    ```

    [Login](login.md) has an example of `LOGIN_PROVIDERS` for LS Login.

4. Start the image of the matching version, behind a reverse proxy that
   serves it over HTTPS:

    ```
    docker run -p 3000:3000 --env-file ~/cloud-registry-ui/settings.env elixircloud/cloud-registry-ui:<version>
    ```

## Compatibility

UI versions follow the registry in major and minor version: UI 1.0.x works with cloud-registry 1.0.x; patch releases are independent. Pre-releases may need a newer pre-release of the registry: **1.0.0-rc2 doesn't work with cloud-registry 1.0.0rc1, although their numbers match** (see below). The first release, 1.0.0-rc1, goes with cloud-registry 1.0.0rc1. Pre-releases are spelled differently: the app follows SemVer and npm (`1.0.0-rc1`, tag `v1.0.0-rc1`), the registry PEP 440 (`1.0.0rc1`, tag `v1.0.0rc1`).

Releases are published as GitHub releases and as images on Docker Hub, `elixircloud/cloud-registry-ui:<version>` (`latest` for the highest release without a pre-release suffix such as `-rc1`, 0.x releases included), built by the release workflow (`.github/workflows/release.yml`) with an SBOM and the build provenance attached, and signed (see [Verifying images](deployment.md#verifying-images)). Until 1.0.0, all releases are marked as pre-releases on GitHub.

Features need a registry of the version below. From 1.0.0-rc2, registries
older than the row **Changing roles of users** states **aren't supported**:
they don't fail, they give roles to the wrong user (see below). The other rows
say which version brought a feature:

| Feature                                                                                      | Needs cloud-registry |
| -------------------------------------------------------------------------------------------- | -------------------- |
| [Admin mode](admins.md#admin-mode)                                                           | 0.6.0                |
| Several login providers (the registry namespaces user IDs by issuer, see [Login](login.md))  | 0.6.0                |
| [Limit on registered services](../user-guide/registering.md#limit-on-registered-services)    | 1.0.0rc1             |
| [Invitations](../user-guide/access.md#inviting-by-link)                                      | 1.0.0rc1             |
| [Labels and expired invitations](../user-guide/access.md#inviting-by-link)                   | newer than 1.0.0rc1  |
| [Changing roles of users](../user-guide/access.md#managing-access), required                 | newer than 1.0.0rc1  |
| [Registration rules](configuration.md#registry) (environments, URL schemes)                  | 0.6.0                |

**From 1.0.0-rc2, the app must ship together with a registry that has the new
paths of users' roles (`/services/{serviceId}/permissions/users/{userId}`):
it has no fallback.** Don't run it with older registries, not even for a while:

- **cloud-registry 0.6.0 and 1.0.0rc1 give roles to the wrong user, and don't
  report an error:** they answer `200 OK`, but grant the role to a user
  `users/bob` instead of `bob`. `bob` gets no access, and a downgrade leaves
  `bob`'s role as it was. The app notices from the answer and reports an error,
  but the wrong role is stored by then.
- **The app can't clean up:** with these registries, removing a user's role
  doesn't remove it, and usually fails with "not found", until the registry is
  upgraded.
- Earlier versions don't find these paths.

No order of apps and registry pods is safe during a rolling update: see
[Upgrading](upgrading.md#100-rc2) and the [registry's upgrade
guide](https://cloud-registry.readthedocs.io/en/latest/upgrading/#from-100rc1).

No release of cloud-registry has these paths, labels and expired invitations
yet, so the end-to-end tests run against its development version.

The app's release 1.0.0-rc1 was tested against cloud-registry 1.0.0rc1 (see the
[release notes](../releases/1.0.0-rc1.md)).

The limit on the services per user (see [Limit on registered
services](../user-guide/registering.md#limit-on-registered-services)) comes
from cloud-registry 1.0.0rc1: the registry sets it (`custom.access_control.max_services_per_user`,
see the [registry's
documentation](https://cloud-registry.readthedocs.io/en/latest/)), and the
app reads it from the service info. Older registries have no limit.

Invitations to services (see [Inviting by
link](../user-guide/access.md#inviting-by-link)) need cloud-registry
1.0.0rc1 or later as well. Their settings, e.g. how long they are valid
and how many a service may have open, are the registry's (see the
[registry's documentation](https://cloud-registry.readthedocs.io/en/latest/)),
and the app has no settings for them, except whether its form requires a
label (see [Access dialog](configuration.md#access-dialog)). Registries before
1.0.0rc1 have no invitations: the app reports this, or, if it runs on another
origin than the registry, only that it can't load them, as browsers then get no
usable answer from the registry.

## Contents

- [Deployment](deployment.md): the Docker image, running it, HTTPS, and
  verifying released images.
- [Configuration](configuration.md): all settings, the registry's
  address, and the registry's rules for registrations that the app follows.
- [Login](login.md): login providers, registering the app with LS Login,
  sessions, and the registry's settings for the app's tokens.
- [Branding](branding.md): the title and logos.
- [Admins and admin mode](admins.md): who is an admin, and what admin mode
  needs.
- [Upgrading](upgrading.md): updating a deployment, and changes that need
  action.
