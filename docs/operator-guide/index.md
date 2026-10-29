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

UI versions follow the registry in major and minor version: UI 0.5.x works with cloud-registry 0.5.x, and UI 1.0.0-rc1 with cloud-registry 1.0.0-rc1; patch releases are independent. The first release, 0.5.0, goes with cloud-registry 0.5.x.

Releases are published as GitHub releases and as images on Docker Hub, `elixircloud/cloud-registry-ui:<version>` (`latest` for the highest release without a pre-release suffix such as `-rc1`, 0.x releases included), built by the release workflow (`.github/workflows/release.yml`) with an SBOM and the build provenance attached, and signed (see [Verifying images](deployment.md#verifying-images)). Until 1.0.0, all releases are marked as pre-releases on GitHub.

Features of newer registries need a registry of that version, e.g. [admin
mode](admins.md#admin-mode) needs cloud-registry 0.6.0 or later. The app
works with older registries without them, e.g. without the switch to admin
mode.

The limit on the services per user (see [Limit on registered
services](../user-guide/registering.md#limit-on-registered-services)) comes
from cloud-registry 1.0.0-rc1: the registry sets it (`custom.access_control.max_services_per_user`,
see the [registry's
documentation](https://cloud-registry.readthedocs.io/en/latest/)), and the
app reads it from the service info. Older registries have no limit.

## Contents

- [Deployment](deployment.md): the Docker image, running it, HTTPS, and
  verifying released images.
- [Configuration](configuration.md): all settings, and the registry's
  address, URL schemes and environments.
- [Login](login.md): login providers, registering the app with LS Login,
  sessions, and the registry's settings for the app's tokens.
- [Branding](branding.md): the title and logos.
- [Admins and admin mode](admins.md): who is an admin, and what admin mode
  needs.
- [Upgrading](upgrading.md): updating a deployment, and changes that need
  action.
