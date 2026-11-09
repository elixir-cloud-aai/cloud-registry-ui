# Admins and admin mode

Admins can do everything in the registry: edit and delete any service,
verify services, approve and remove service types, choose and change
service IDs, and list the registry among its own services (see [Admin
mode](../user-guide/admin-mode.md) in the user guide). The app has no admin
settings of its own: it asks the registry
(`GET /me`) whether the user is an admin, and shows the controls
accordingly. The registry enforces the same rules.

## Making users admins

The registry makes the members of some groups admins: the groups that its
configuration maps to the role `admin` (`security.access_control.group_mapping`),
read from a claim of the users' tokens or user info
(`security.access_control.claim_groups`). See the registry's
[admins](https://cloud-registry.readthedocs.io/en/latest/access-control/#admins)
and [Registry settings for the app](login.md#registry-settings-for-the-app)
for LS Login, whose groups are in `eduperson_entitlement`.

Make sure that the login provider releases the group claim to the app:
for LS Login, the app must request the scope `eduperson_entitlement` (see
[Login](login.md)). Otherwise, the registry recognises no admins.

Which groups grant admin rights is specific to each deployment: document
it, and whom users should contact, in your deployment's own docs.

## Admin mode

Admin mode (cloud-registry 0.6.0 and later): admins act as admins only in
admin mode, so that admin rights are a deliberate choice. Users who may be
admins (`adminAvailable` of `GET /me`) see a toggle in the top bar, "User
mode" or "Admin mode"; they start in user mode, with the rights of other
users. In admin mode, every request with the user's token asks for the
admin role (header `X-Request-Roles: admin`), so the registry must allow
that header from the app's origin (FOCA's `security.cors`; its default
allows all headers). The mode is kept in the cookie `admin_mode` for the
browser session, and logins and logouts end it.

Registries without admin mode (before 0.6.0, or with
`security.access_control.opt_in_roles: []`) show no toggle: their admins
are always admins. See the registry's [admin
mode](https://cloud-registry.readthedocs.io/en/latest/access-control/#admin-mode).

## Listing the registry itself

Admins can list the registry among its own services from the service info page
(see [Listing the registry
itself](../user-guide/admin-mode.md#listing-the-registry-itself) in the user
guide). The app has no settings for it. In admin mode only, it calls `GET`,
`PUT` and `DELETE /service-info/listing` of the registry (cloud-registry
1.0.0rc2 and later), so the registry must allow these methods from the app's
origin (FOCA's `security.cors`; its default allows them).

The registry never syncs this entry with service info, so its page in the app
says so instead of offering **Turn sync on** (which the registry would refuse).

The registry builds the entry from its settings, so these decide whether it can
be listed, and how:

- the entry's URL is the public URL of the registry (`server.public_url`) with
  the base path of its API: set any path prefix of a reverse proxy there;
- the scheme of the public URL must be allowed for services
  (`custom.endpoints.services.url_schemes`), by default `https` only;
- the environment of the service info (`service_info.service.environment`) must
  be allowed (`custom.endpoints.services.environments`);
- the ID of the service info (`service_info.service.id`) can't be used for
  services if it is empty, `.`, `..` or `types`, or has slashes.

Otherwise, the registry refuses, and the page shows its reason. See the
registry's [listing of the registry
itself](https://cloud-registry.readthedocs.io/en/latest/api/#listing-the-registry-itself).
