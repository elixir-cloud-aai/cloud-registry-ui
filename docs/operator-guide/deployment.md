# Deployment

The app runs as a Docker container (or with `bun run start`, see
[Development](../development.md)). It also runs on
[Vercel](https://vercel.com/), which builds it from the repository; see
[Configuration](configuration.md) for what differs there.

## Docker

The image has no settings of its own, so one image serves any deployment: use a released image (see [Compatibility](index.md#compatibility)), or build it without settings, and pass them all when the container starts (see [Configuration](configuration.md)).

```
docker pull elixircloud/cloud-registry-ui:<version>
# or
docker build -t cloud-registry-ui .
```

`.dockerignore` lets only the sources and build files into the build (an allow list), without `.env*` files, keys or credentials, so local settings and secrets outside the sources can't reach the build, its cache or the image.

Pass the settings when the container starts, e.g. from a file outside the repository, such as `~/cloud-registry-ui/settings.env`, with at least `NEXT_PUBLIC_CLOUD_REGISTRY_URL` and the login settings (`LOGIN_PROVIDERS` and `LOGIN_REDIRECT_URI`, see [Login](login.md)), which hold the client secret. `--env-file` takes each line as `NAME=value`, literally: don't quote the values.

```
docker run -p 3000:3000 --env-file ~/cloud-registry-ui/settings.env cloud-registry-ui
```

Without the required settings, or with invalid ones, the container refuses to start.

One image can be used for all environments of a deployment (e.g. staging and production). Deployments that passed the `NEXT_PUBLIC_*` settings as build arguments must pass them with `docker run` now (see [Upgrading](upgrading.md#settings-at-start-instead-of-build-arguments)).

The image holds only the built app: Next's standalone server (`bun server.js`), its static files and `public/`, without sources or development dependencies. It runs as the unprivileged user `bun`, which can write only to `.next/cache`, listens on all IPv4 interfaces (set `LISTEN_HOSTNAME`, e.g. to `::` for IPv6, to change this) and on `PORT` (default: 3000), and reports its health (`docker ps`) by requesting the start page every 30 seconds. Serve it over HTTPS, e.g. behind a reverse proxy: the login cookies are marked `Secure`, and browsers accept them over plain HTTP only on `localhost`.

## Behind a reverse proxy

Serve the app over HTTPS, at the address of `LOGIN_REDIRECT_URI` (see
[Login](login.md)):

- Forward all paths to the container, e.g. `/dashboard`, `/auth` and
  `/_next`. If the app and the registry share a host, forward the
  registry's base path (e.g. `/ga4gh/registry/v1`) to the registry
  instead.
- Don't add a Content Security Policy in the proxy (see
  [Registry](configuration.md#registry)): the app sets its own, with a
  nonce per request.
- Don't cache the pages: they are rendered per request.

## Verifying images

Released images are built by the release workflow on GitHub Actions, with an SBOM and the build provenance attached as attestations, a [GitHub artifact attestation](https://docs.github.com/en/actions/concepts/security/artifact-attestations) of their provenance, and a keyless [Sigstore](https://www.sigstore.dev/) signature. To check that an image was built by the release workflow for its tag, run (with the [GitHub CLI](https://cli.github.com/) or [cosign](https://docs.sigstore.dev/cosign/system_config/installation/) 3 or later), e.g. for 0.5.0:

```
gh attestation verify oci://docker.io/elixircloud/cloud-registry-ui:0.5.0 \
  --repo elixir-cloud-aai/cloud-registry-ui \
  --signer-workflow elixir-cloud-aai/cloud-registry-ui/.github/workflows/release.yml \
  --source-ref refs/tags/v0.5.0
cosign verify docker.io/elixircloud/cloud-registry-ui:0.5.0 \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity https://github.com/elixir-cloud-aai/cloud-registry-ui/.github/workflows/release.yml@refs/tags/v0.5.0
```

Replace 0.5.0 with the version to verify. `--source-ref` and the ref in `--certificate-identity` check that the workflow ran for the release tag, not for another branch or tag; other images, e.g. ones you build yourself, aren't releases.

To show an image's SBOM or provenance, run `docker buildx imagetools inspect docker.io/elixircloud/cloud-registry-ui:0.5.0 --format '{{ json .SBOM }}'` (or `.Provenance`).
