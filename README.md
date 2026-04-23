# ELIXIR Cloud Registry UI

Web frontend for the ELIXIR Cloud service registry, providing a user interface for browsing and managing GA4GH Service Registry entries.

## Installation

### Requirements

- [Git](https://git-scm.com/)
- [Bun 1.2+](https://bun.com/)
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


## Contributing

This project is a community effort and lives off your contributions, be it in the form of bug reports, feature requests, discussions, or fixes and other code changes. Please refer to our project's contribution guidelines if you are interested in contributing.