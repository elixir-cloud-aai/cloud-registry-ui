# Branding

The title and the logos of the app can be changed, so that a deployment
shows its own name and organization. The features of the app stay the
same. The [User guide](../user-guide/index.md) shows the default branding.

All optional; read when the app starts. Logos given as paths must be in `public/` when the app is built (in the Docker image: the default logos; use URLs for others).

| Variable                        | Default                              | Description                                                                                                                                                                                                                                                                                       |
| ------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_TITLE`         | `Cloud Registry`                     | Title at the top of the sidebar and of the browser tab; at most two lines of at most 24 characters, broken at spaces                                                                                                                                                                             |
| `NEXT_PUBLIC_APP_TITLE_SIZE`    | 24 (one line), what fits (two lines) | Largest font size of the sidebar title, in pixels; can only lower the default (larger values are capped at 24 px for one line and at what fits for two, about 16 px)                                                                                                                              |
| `NEXT_PUBLIC_APP_TITLE_FONT`    | Open Sans                            | CSS `font-family` of the sidebar title, e.g. `Georgia, serif`; other web fonts must be loaded by the page                                                                                                                                                                                         |
| `NEXT_PUBLIC_APP_LOGO`          | `/elixir-on-cloud-mark.svg`          | Logo next to the title (square); a path in `public/` or a URL                                                                                                                                                                                                                                     |
| `NEXT_PUBLIC_APP_LOGO_DARK`     | `/elixir-on-cloud-mark-night.svg`    | `_DARK` = the logo shown in the dark colour scheme, i.e. a light-coloured logo for a dark background; the default applies only with the default `NEXT_PUBLIC_APP_LOGO`: a custom `NEXT_PUBLIC_APP_LOGO` without `_DARK` is shown in both colour schemes, on a white backing in the dark one       |
| `NEXT_PUBLIC_FOOTER_LOGO`       | `/elixir-on-cloud-lockup.svg`        | Logo at the bottom of the sidebar, right of the copyright (40 px high); a path in `public/` or a URL                                                                                                                                                                                              |
| `NEXT_PUBLIC_FOOTER_LOGO_DARK`  | `/elixir-on-cloud-lockup-night.svg`  | `_DARK` = the logo shown in the dark colour scheme, i.e. a light-coloured logo for a dark background; the default applies only with the default `NEXT_PUBLIC_FOOTER_LOGO`: a custom `NEXT_PUBLIC_FOOTER_LOGO` without `_DARK` is shown in both colour schemes, on a white backing in the dark one |
| `NEXT_PUBLIC_FOOTER_START_YEAR` | (none)                               | First year of the copyright line: `© START – CURRENT`, else `© CURRENT`                                                                                                                                                                                                                           |

For example, a deployment with its own title and logos at URLs:

```
NEXT_PUBLIC_APP_TITLE=Example Service Registry
NEXT_PUBLIC_APP_LOGO=https://example.org/logos/registry-mark.svg
NEXT_PUBLIC_APP_LOGO_DARK=https://example.org/logos/registry-mark-light.svg
NEXT_PUBLIC_FOOTER_LOGO=https://example.org/logos/example-lockup.svg
NEXT_PUBLIC_FOOTER_START_YEAR=2025
```

The app's Content Security Policy allows images from any `https` URL, so
logos at other sites load without further settings. The logo of each login
provider is set in `LOGIN_PROVIDERS` (see [Login](login.md)).
