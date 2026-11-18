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
links with a `label` and a `url`. Without it, the app shows no footer.

![The footer with three links](../images/footer-links.png)

The footer is shown at the bottom of every page: below the content of the
pages with the sidebar, and on the login page, the invitation page and the
error page of the login. Links to other sites open in a new tab, so that
unsaved changes in the app stay.

| Key     | Description                                                                                                                                                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label` | Text of the link, at most 60 characters                                                                                                                                                                                                                                                                         |
| `url`   | Where it leads: an `https` URL (`http` only for `localhost` and loopback addresses), a `mailto:` address, or a path of the app starting with `/` (e.g. a file in `public/` when the app is built; the Docker image has no files of yours, so use `https` URLs there). Other schemes, such as `javascript:`, are refused |

The list may have at most 12 links, shown in its order. Invalid settings
stop the app with a message that names the problem, as other settings do
(see [Configuration](configuration.md)); a blank setting, or `[]`, shows no
footer.

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
analytics, no tracking, no advertising, and no content from other sites
(its fonts are served by the app itself, and its Content Security Policy
lets pages load scripts only from the app). It stores only what the login
needs and what users choose themselves:

| Name                                                                    | Kind                            | Set when                                       | Kept for                                                         | Purpose                                                                                                   |
| ----------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `__Host-access_token`, `__Host-id_token`, `__Host-login_provider`         | Cookies                         | a user logs in                                 | the session, at most 12 hours; deleted when the user logs out    | the login: the tokens of the login provider, and which provider it was                                  |
| `__Host-authState`, `__Host-authProvider`, `__Host-authVerifier`, `__Host-authNonce`, `__Host-authReturnTo` | Cookies (server only) | a user starts to log in | at most 30 minutes; deleted when the login ends | protection of the login against forged answers (OpenID Connect `state`, PKCE, `nonce`), and the page to return to |
| `admin_mode`                                                            | Cookie                          | an admin switches on admin mode                | the browser session; deleted when switched off or on logout      | the admin mode that the admin chose                                                                       |
| `sidebar_state`                                                         | Cookie                          | a user collapses or expands the sidebar        | 7 days                                                           | whether the sidebar is collapsed                                                                          |
| `theme`                                                                 | Local storage                   | a user switches between light and dark mode    | until the user clears the site's data                            | the colour scheme that the user chose                                                                     |
| `pendingInvitation`                                                     | Session storage                 | a guest opens an invitation link               | the tab; deleted when the invitation is accepted                 | the invitation to accept after the login                                                                  |

Development servers (`bun run dev`) use the cookie names without the
`__Host-` prefix. A guest who only browses, without logging in or changing
these settings, gets no cookies and nothing in the browser's storage (the
end-to-end tests check this).

Under the EU's ePrivacy rules, and most similar laws, storage that is strictly
necessary for a service that the user asked for (here: the login, and the
settings that users change themselves) needs no consent; the privacy notice
must still describe it. The table above is meant for that notice, together
with what the deployment processes otherwise, e.g.:

- the user's identity from the login provider (name, e-mail address,
  identifier, groups), which the registry stores with the services, roles,
  invitations and notifications of the user (see the registry's
  documentation);
- the logs of the app's server, of the reverse proxy in front of it and of
  the registry, e.g. with IP addresses.

If a deployment adds anything that needs consent, such as analytics in a
modified build or in a proxy in front of the app, it also needs a way to
ask for that consent, which the app doesn't have.
