# Legal notices and cookies

Most deployments must link to legal information, such as a privacy notice,
terms of use or an imprint. What they need depends on the operator and on
the rules that apply to them, so the app ships no such texts and no links to
them: each deployment sets its own links in the footer. The operator stays
responsible for the texts and for the rules that apply to them. This page
describes what the app does, not what the law requires: it isn't legal
advice.

## Footer links

`NEXT_PUBLIC_FOOTER_LINKS` sets the links of the footer, as a JSON list of
links with a `label` and a `url`. Without it, the app shows no links.

![The footer with three links](../images/footer-links.png)

The links are shown in a footer at the bottom of the app's pages, separate
from the copyright line and logo at the bottom of the sidebar (see
[Branding](branding.md)): below the content of the pages with the sidebar,
and on the login page, the invitation page and the error page of the
login; not on the "page not found" page. Links to other sites open in a new
tab, so that unsaved changes in the app stay.

| Key     | Description                                                                                                                                                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label` | Text of the link, at most 60 characters                                                                                                                                                                                                                                                                         |
| `url`   | Where it leads: an `https` URL (`http` only for `localhost` and loopback addresses), a `mailto:` address, or a path of the app starting with `/` (e.g. a file in `public/` when the app is built; the Docker image has no files of yours, so use `https` URLs there). Other schemes, such as `javascript:`, are refused |

The list may have at most 12 links, shown in its order. Invalid settings
stop the app with a message that names the problem, as other settings do
(see [Configuration](configuration.md)); a blank setting, or `[]`, shows no
links.

For example, a deployment with the usual links:

```
NEXT_PUBLIC_FOOTER_LINKS='[
  {"label": "Privacy Policy", "url": "https://example.org/privacy"},
  {"label": "Terms & Conditions", "url": "https://example.org/terms"},
  {"label": "Imprint", "url": "https://example.org/imprint"},
  {"label": "Accessibility Statement", "url": "https://example.org/accessibility"},
  {"label": "Contact Us", "url": "mailto:registry@example.org"}
]'
```

In an `--env-file` of `docker run`, write the list on one line and without
the quotes: Docker takes each line as it is.

Pages that the app doesn't serve, such as the privacy notice itself, must be
hosted elsewhere, e.g. on the operator's website. A link may also lead to a
page of a service that writes such texts (e.g. iubenda, Termly or GetTerms):
the app loads none of their scripts or embeds, and its Content Security
Policy would block them.

## Cookies and storage

The app has no cookie banner, as it stores nothing that needs consent: no
analytics, no tracking and no advertising. It stores only what the login
needs and what users choose themselves:

- **Session** (cookies `__Host-access_token`, `__Host-id_token` and
  `__Host-login_provider`): set when a user logs in, kept for the session
  (at most 12 hours) and deleted when the user logs out; the tokens of the
  login provider, and which provider it was.
- **Login in progress** (cookies `__Host-authState`, `__Host-authProvider`,
  `__Host-authVerifier`, `__Host-authNonce` and `__Host-authReturnTo`, read
  by the server only): set when a user starts to log in, kept for at most 30
  minutes and deleted when the login ends; they protect the login against
  forged answers (OpenID Connect `state` and `nonce`, PKCE) and keep the
  page to return to.
- **Admin mode** (cookie `admin_mode`): set when an admin switches admin
  mode on, kept until the browser closes, and deleted when it is switched
  off or the admin logs out.
- **Colour scheme** (local storage `theme`): set when a user switches
  between light and dark mode, kept until the user clears the site's data.
- **Invitation** (session storage `pendingInvitation`): set when someone
  opens an invitation link, kept in that tab, and deleted when the
  invitation is accepted or can't be used; it keeps the invitation to
  accept after the login.

Development servers (`bun run dev`) use the cookie names without the
`__Host-` prefix. A guest who only browses, without logging in or changing
these settings or opening an invitation link, gets no cookies and nothing
in the browser's storage (the end-to-end tests check this for the services
list, the invitation page and the login page).

Under the EU's ePrivacy rules, and most similar laws, storage that is strictly
necessary for a service that the user asked for (here: the login, and the
settings that users change themselves) needs no consent; the privacy notice
must still describe it. The list above is meant for that notice, together
with what the deployment processes otherwise, e.g.:

- the user's identity from the login provider (name, e-mail address,
  identifier, groups), which the registry stores with the services, roles,
  invitations and notifications of the user (see the registry's
  documentation);
- the logs of the app's server, of the reverse proxy in front of it and of
  the registry, e.g. with IP addresses;
- logos at URLs of other sites (`NEXT_PUBLIC_APP_LOGO`,
  `NEXT_PUBLIC_FOOTER_LOGO` and their `_DARK` variants, see
  [Branding](branding.md), and the logos of the login providers, see
  [Login](login.md)): browsers load them from those sites, which see the
  visitor's IP address. The default logos, the fonts and the scripts are
  served by the app itself, and its Content Security Policy lets pages
  load scripts only from the app. To keep visitors' browsers away from
  other sites, use logos served from the app (paths in `public/`, which
  needs a build of your own) or from a site that the privacy notice names.

If a deployment adds anything that needs consent, such as analytics in a
modified build or in a proxy in front of the app, it also needs a way to
ask for that consent, which the app doesn't have.
