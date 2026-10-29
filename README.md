# Cloud Registry UI

Web frontend for the ELIXIR Cloud service registry ([cloud-registry](https://github.com/elixir-cloud-aai/cloud-registry)), providing a user interface for browsing and managing GA4GH Service Registry entries: registering and editing services, verifications, access management, service types and their approval.

## Documentation

The documentation is on [Read the Docs](https://cloud-registry-ui.readthedocs.io/en/latest/):

- [User guide](https://cloud-registry-ui.readthedocs.io/en/latest/user-guide/): browsing and searching, registering and editing services, access and permissions, verifications, pending entries and admin mode.
- [Operator guide](https://cloud-registry-ui.readthedocs.io/en/latest/operator-guide/): compatibility, deployment with Docker, configuration, login, branding, admins and upgrading.
- [Development](https://cloud-registry-ui.readthedocs.io/en/latest/development/): development setup, tests and the docs.

The registry itself is documented in the [Cloud Registry docs](https://cloud-registry.readthedocs.io/en/latest/).

## Quick start

UI versions follow the registry in major and minor version (see [Compatibility](https://cloud-registry-ui.readthedocs.io/en/latest/operator-guide/#compatibility)). Images are on Docker Hub, `elixircloud/cloud-registry-ui:<version>`, and take all settings when the container starts:

```
docker run -p 3000:3000 --env-file ~/cloud-registry-ui/settings.env elixircloud/cloud-registry-ui:<version>
```

The settings file needs at least `NEXT_PUBLIC_CLOUD_REGISTRY_URL`, `LOGIN_PROVIDERS` and `LOGIN_REDIRECT_URI` (see [Configuration](https://cloud-registry-ui.readthedocs.io/en/latest/operator-guide/configuration/) and [Login](https://cloud-registry-ui.readthedocs.io/en/latest/operator-guide/login/)). For development, see [Development](https://cloud-registry-ui.readthedocs.io/en/latest/development/); the sources of the docs are in [`docs/`](docs/).

## Contributing

This project is a community effort and lives off your contributions, be it in the form of bug reports, feature requests, discussions, or fixes and other code changes. Please refer to our project's [contribution guidelines](CONTRIBUTING.md) if you are interested in contributing.
