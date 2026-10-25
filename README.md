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
docker run -p 3000:3000 cloud-registry-ui
```

## Configurations

The app is configured through environment variables. Copy .env.example to .env and adjust as needed.

Set `NEXT_PUBLIC_SERVICE_URL_SCHEMES` to `http,https` if the registry also allows `http` service URLs (`custom.endpoints.services.url_schemes`; default: `https`). Like all `NEXT_PUBLIC_*` variables, it must be set when the app is built.

Branding (all optional). These are build-time values: set them in `.env` (or the environment) before `bun run build` or `docker build`; `docker run -e` does not change a built image.

| Variable                        | Default                       | Description                                                                  |
| ------------------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_TITLE`         | `Cloud Registry`              | Title at the top of the sidebar and of the browser tab                       |
| `NEXT_PUBLIC_APP_LOGO`          | `/elixir-on-cloud-mark.svg`   | Logo next to the title (square); a path in `public/` or a URL                |
| `NEXT_PUBLIC_FOOTER_LOGO`       | `/elixir-on-cloud-lockup.svg` | Logo at the bottom of the sidebar (full width); a path in `public/` or a URL |
| `NEXT_PUBLIC_FOOTER_START_YEAR` | (none)                        | First year of the copyright line: `© START – CURRENT`, else `© CURRENT`      |


## Contributing

This project is a community effort and lives off your contributions, be it in the form of bug reports, feature requests, discussions, or fixes and other code changes. Please refer to our project's contribution guidelines if you are interested in contributing.
