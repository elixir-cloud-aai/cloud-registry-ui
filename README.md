<a href="https://elixir-on.cloud/">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/images/logo_elixir_on_cloud_night.png">
    <img src="docs/images/logo_elixir_on_cloud.png" alt="ELIXIR On-Cloud">
  </picture>
</a>

# Cloud Registry UI

[![License][badge-license]][badge-url-license]
[![Build_status][badge-build-status]][badge-url-build-status]
[![Docs][badge-docs]][badge-url-docs]

A web front end for [Cloud Registry][cloud-registry], a registry of web
services that implements the [GA4GH Service Registry
API](https://github.com/ga4gh-discovery/ga4gh-service-registry), brought to
you by [ELIXIR On-Cloud](https://elixir-on.cloud/). Anyone can browse and
search the services of the registry (unless it requires login); users logged
in with an OpenID Connect provider, such as LS Login, register and edit their
services, share them with their team and invite others by link, and admins
verify services and approve new service types. The app is generic: deploy it
for your own registry with its Docker image, with your logos, titles and login
providers.

**Read the [documentation][docs]**: the [user guide][docs-user-guide], the
[operator guide][docs-operator-guide] for the deployment, configuration,
login, branding, admins and upgrades, and [development][docs-development].

## Known deployments

| Deployment | Operated by | Notes |
| --- | --- | --- |
| <https://registry.elixir-on.cloud/> | [ELIXIR On-Cloud](https://elixir-on.cloud/) | Front end of the ELIXIR On-Cloud registry |

Running the Cloud Registry UI yourself? Open a pull request that adds your
deployment to the table in [`README.md`](README.md).

## Quick start

UI versions follow the registry in major and minor version (see
[Compatibility][docs-compatibility]). Write the settings to a file outside
the repository, e.g. `~/cloud-registry-ui/settings.env`, with at least
`NEXT_PUBLIC_CLOUD_REGISTRY_URL`, `LOGIN_PROVIDERS` and `LOGIN_REDIRECT_URI`
(see [Configuration][docs-configuration] and [Login][docs-login]), and start
the image of the matching version; it takes all settings when the container
starts:

```bash
docker run -p 3000:3000 --env-file ~/cloud-registry-ui/settings.env elixircloud/cloud-registry-ui:<version>
```

The [operator guide][docs-operator-guide] walks you through registering the
app with your login provider and configuring the registry for it.

## Citation

If you use the Cloud Registry UI, please cite it with the metadata in
[`CITATION.cff`](CITATION.cff): on GitHub, "Cite this repository" in the
sidebar of the repository formats it as APA or BibTeX.

## Contributing

Contributions are welcome! See [`CONTRIBUTING.md`](CONTRIBUTING.md) and
[Development][docs-development] in the documentation; the sources of the
documentation are in [`docs/`](docs/).

[badge-build-status]: <https://github.com/elixir-cloud-aai/cloud-registry-ui/actions/workflows/ci.yml/badge.svg>
[badge-docs]: <https://img.shields.io/readthedocs/cloud-registry-ui>
[badge-license]: <https://img.shields.io/badge/license-Apache%202.0-blue.svg>
[badge-url-build-status]: <https://github.com/elixir-cloud-aai/cloud-registry-ui/actions/workflows/ci.yml>
[badge-url-docs]: <https://cloud-registry-ui.readthedocs.io/en/latest/>
[badge-url-license]: <https://www.apache.org/licenses/LICENSE-2.0>
[cloud-registry]: <https://cloud-registry.readthedocs.io/en/latest/>
[docs]: <https://cloud-registry-ui.readthedocs.io/en/latest/>
[docs-compatibility]: <https://cloud-registry-ui.readthedocs.io/en/latest/operator-guide/#compatibility>
[docs-configuration]: <https://cloud-registry-ui.readthedocs.io/en/latest/operator-guide/configuration/>
[docs-development]: <https://cloud-registry-ui.readthedocs.io/en/latest/development/>
[docs-login]: <https://cloud-registry-ui.readthedocs.io/en/latest/operator-guide/login/>
[docs-operator-guide]: <https://cloud-registry-ui.readthedocs.io/en/latest/operator-guide/>
[docs-user-guide]: <https://cloud-registry-ui.readthedocs.io/en/latest/user-guide/>
