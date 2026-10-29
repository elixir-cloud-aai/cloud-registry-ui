[![ELIXIR On-Cloud](images/elixir-on-cloud-lockup.svg){ width="240" }](https://elixir-on.cloud/)

# Cloud Registry UI

The Cloud Registry UI is a web app for browsing and managing the services
of a [Cloud Registry](https://cloud-registry.readthedocs.io/en/latest/), an
implementation of the [GA4GH Service
Registry](https://github.com/ga4gh-discovery/ga4gh-service-registry) API:
find services, register and edit your own, share them with your team,
verify them and approve new service types.

The app is generic: anyone can deploy it for their own registry. Its
features are the same in every deployment; operators only change the logos
and titles ([branding](operator-guide/branding.md)), the login providers and
the registry it talks to.

## Contents

- [User guide](user-guide/index.md): for people who use a deployment of the
  app, e.g. to find services or to register their own.
- [Operator guide](operator-guide/index.md): for people who deploy and run
  the app: the Docker image, its settings, login, branding, admins and
  upgrading.
- [Development](development.md): development setup, tests and the docs.

Deployment-specific information, such as the address of a deployment, its
login provider, which groups grant which rights and whom to contact, is in
the documentation of each deployment, not here. For the deployment of ELIXIR
On-Cloud, see the [ELIXIR Cloud documentation](https://elixir-cloud-aai.github.io/).

## The registry

The app shows what the registry stores and enforces: who may do what,
which service types and environments are allowed, and which entries are
pending, all come from the registry and its configuration. The [Cloud
Registry documentation](https://cloud-registry.readthedocs.io/en/latest/)
describes the API, its [access
control](https://cloud-registry.readthedocs.io/en/latest/access-control/)
and its [configuration](https://cloud-registry.readthedocs.io/en/latest/configuration/).

## License

This project is covered by the [Apache License
2.0](https://www.apache.org/licenses/LICENSE-2.0), also [shipped with this
repository](https://github.com/elixir-cloud-aai/cloud-registry-ui/blob/main/LICENSE).

## Contact

The project is a collaborative effort under the umbrella of [ELIXIR
On-Cloud](https://elixir-on.cloud/). Follow the link to get in touch with us
via chat or email. Please mention the name of this service for any inquiry,
proposal, question etc.
