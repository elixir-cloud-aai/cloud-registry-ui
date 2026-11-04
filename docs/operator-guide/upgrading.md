# Upgrading

## Updating a deployment

1. Pick the release that matches your registry's major and minor version
   (see [Compatibility](index.md#compatibility)). When you upgrade the
   registry to a new minor version, upgrade the app with it. 1.0.0-rc2 is an
   exception: it doesn't work with cloud-registry 1.0.0rc1 (see
   [below](#100-rc2)).
2. Read its release notes on
   [GitHub](https://github.com/elixir-cloud-aai/cloud-registry-ui/releases),
   and the changes below, for settings to add or change.
3. [Verify the image](deployment.md#verifying-images), update the settings
   if needed, and replace the container with one of the new image.

The app keeps no data of its own: everything is stored in the registry, so
the app can be replaced at any time, except when you upgrade to or from
1.0.0-rc2 (see [below](#100-rc2)). Users who are logged in keep their
session (it is kept in cookies), unless the release notes say otherwise.
Logins that are in progress during the update may fail; users then log in
again.

## 1.0.0-rc2

**Upgrade the registry together with the app: this version needs a registry
newer than cloud-registry 1.0.0rc1, and has no fallback for older ones.** The
registry moved the paths of users' roles to
`/services/{serviceId}/permissions/users/{userId}`, and the app calls only
these. Don't run this version with cloud-registry 1.0.0rc1: the registry
answers `200 OK`, but grants the role to a user `users/bob` instead of `bob`
(0.6.0 takes these paths the same way, and earlier versions don't find them).
Earlier versions of the app can't change roles of users with the new registry,
which no longer finds the old paths; if user IDs start with `users/`, they even
change the roles of another user, so stop them first.

So no order of apps and registry pods is safe during a rolling update. Follow
the [registry's upgrade guide](https://cloud-registry.readthedocs.io/en/latest/upgrading/#from-100rc1):
scale the registry to 0 replicas for the upgrade, unless nobody changes roles
during it. After a rolling update, look for wrongly granted roles as the guide
describes.

If the app ran with an older registry, it can't repair the result: it reports
an error for such a grant, but the wrong role stays stored, and a downgrade
leaves the real user's role as it was. With that registry, **Remove** on `bob`
removes the role of `users/bob`, if there is one, and otherwise fails, usually
with "not found", but never touches `bob`'s role, so check all role changes made in that
time. Upgrade the registry, then remove the wrong roles as the guide describes.
To go back from this
version, move the registry and the app back together, as the guide describes
under **Going back**.

The app refuses user IDs and groups that start with `/`, as their paths would
be those of another user or group. Roles of such IDs, which should be rare, can
no longer be changed in the app, which says so when you try.

The **Manage access** dialog now has the tabs **Current Access** and
**Invitations**, and shows 5 entries per page instead of 8. To change that,
set `NEXT_PUBLIC_ACCESS_PAGE_SIZE` (see [Access
dialog](configuration.md#access-dialog)); there is nothing else to change.
It no longer lists accepted invitations, as the person is listed with their
role.

Invitations now have labels, which say who they are for, and **the form
requires one by default**. To keep it optional, set
`NEXT_PUBLIC_INVITATION_LABEL_REQUIRED=false` (see [Access
dialog](configuration.md#access-dialog)). Expired invitations stay listed,
marked as expired, with **New link**, removal and **Remove expired**. Both
need a registry newer than cloud-registry 1.0.0rc1. If the app meets 1.0.0rc1
during an upgrade, it creates links without the label and says so, and doesn't
list expired invitations, as that registry doesn't; this is no reason to run
that pairing, which gives roles to the wrong user, as described above.

## 1.0.0-rc1

Upgrade the registry to cloud-registry 1.0.0rc1 together with the app
(see [Compatibility](index.md#compatibility)). It brings two features that
the app uses once the registry has them, **without any setting to change in
the app**:

- **Invitations:** owners invite users to services by link (see [Inviting
  by link](../user-guide/access.md#inviting-by-link) and [Accepting an
  invitation](../user-guide/invitations.md)). Their expiry and limits, and
  what the registry shows of those who accepted, are the registry's
  settings.
- **Limit of services per user:** the registry's setting
  `custom.access_control.max_services_per_user` (50 by default; 0 allows
  only admins to register services) is published in its service info, and
  the app reports it when a registration is refused (see [Limit on
  registered services](../user-guide/registering.md#limit-on-registered-services)).
  Check that the default suits your users before the upgrade.

With registries older than 1.0.0rc1, the app keeps working: it reports
that the registry has no invitations, and there is no limit.

## Changes since unreleased versions

These changes apply to deployments of earlier, unreleased versions, e.g.
built from the repository.

### Settings at start instead of build arguments

Before, the `NEXT_PUBLIC_*` settings were build arguments of the Docker
image. Now, all settings are read when the app starts, and one image serves
any deployment. Existing deployments must pass them with `docker run` now
(see [Docker](deployment.md#docker)): `docker build --build-arg
NEXT_PUBLIC_*` only prints a warning, and new images no longer hold them in
their history. The names of the settings are unchanged, so `.env` files
and Vercel projects keep working.

### Registration rules instead of settings

Before, the environments and URL schemes that the registry allows for
services had to be set in the app as well (`NEXT_PUBLIC_SERVICE_ENVIRONMENTS`
and `NEXT_PUBLIC_SERVICE_URL_SCHEMES`), in line with the registry's config.
Now, the app reads them from the registry's service info (see
[Registry](configuration.md#registry)), so they can't differ from what the
registry enforces (cloud-registry 0.6.0 and later publish them; with older
registries, the edit form takes any environment and any `http` or `https`
URL, and the registry checks them). Remove the two settings from your
deployment (`docker run -e`, `.env`, Vercel project): if they are still
set, the app ignores them and logs a warning when it starts ("Ignoring
setting …").

### Login providers instead of `LS_LOGIN_URL` and `OIDC_*`

Earlier versions supported only LS Login. Replace these variables:

| Before               | Now                                                           |
| -------------------- | ------------------------------------------------------------- |
| `LS_LOGIN_URL`       | `issuer` of the provider: `LS_LOGIN_URL` followed by `/oidc/` |
| `OIDC_CLIENT_ID`     | `clientId` of the provider                                    |
| `OIDC_CLIENT_SECRET` | `clientSecret` of the provider                                |
| `OIDC_REDIRECT_URI`  | `LOGIN_REDIRECT_URI` (same value)                             |

Use the [LS Login example](login.md), with `"scopes"` as shown to keep
requesting the same scopes. Users who are logged in stay logged in. The app
stops with a message if it finds the old variables without
`LOGIN_PROVIDERS`. On Vercel, change the project's environment variables
before deploying this version: the build fails if the old ones are set
without `LOGIN_PROVIDERS`. Old variables that are still set next to
`LOGIN_PROVIDERS` are ignored, with a warning that names each of them (not
their values) when the app starts: remove them, so that no stale client
secret (`OIDC_CLIENT_SECRET`) stays in the deployment.

### Admin mode

With cloud-registry 0.6.0 and later, admins act as admins only in admin
mode, which they switch on in the app (see [Admins and admin
mode](admins.md#admin-mode)). All releases of the app support it; builds
from before admin mode was added don't send the admin role, so their
admins can't act as admins with such a registry. Replace them with a
release.
