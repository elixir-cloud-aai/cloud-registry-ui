# Registering and editing services

Any logged-in user can register services, and becomes their **owner**.
Owners can edit and delete them, and give others access (see [Access and
permissions](access.md)).

## Registering a service

1. Log in, open **Services** and select **Register Service**. The form
   opens in a modal; links to `/dashboard/services/create` open it too
   (after the login, for users who aren't logged in).
2. Fill in the form:
    - **Service Name**: a descriptive name, e.g. "TES North".
    - **Service URL**: the base URL of the service's API, e.g.
      `https://tes.example.org/ga4gh/tes/v1`. Most deployments accept only
      `https` URLs.
    - **Organization Name** and **Organization URL**: who runs the service.
    - **Service Type**: the API that the service implements, chosen from
      the registered types, e.g. `org.ga4gh · tes · 1.1.0` (see [Service
      types](browsing.md#service-types)). If none fits and you may add
      types, choose **Add new service type** and enter its **Type Group**,
      **Type Artifact** and **Type Version**, e.g. `org.ga4gh`, `tes` and
      `1.1.0`.
    - **Service Version**: the version of the service's software.
    - **Environment**: one of those that the deployment allows, e.g.
      `prod` or `test`; a text field if it allows any.
    - **Contact URL** (e.g. `mailto:support@example.org`) and
      **Documentation URL**.
    - **Description**: what the service offers, and to whom.
3. Select **Create Service**. The modal closes, and a message confirms the
   registration, with a link to the new service (**View service**).
   **Reset** empties the form.

If you close the modal (with its close button, <kbd>Esc</kbd> or a click
next to it) with unsaved input, the app asks first, and so it does if you
leave or reload the page. Errors leave the modal open, so that you can
correct the entries.

![The form for registering services](../images/register-service.png)

The registry gives the service an ID. Admins in admin mode (see [Admin
mode](admin-mode.md)) also see **Advanced Configuration**, where they can
choose the ID (**Custom Service ID**) and set the dates (**Created At**,
**Updated At**); for other users, the registry sets them. Switch to admin
mode before opening the form.

Before sending, the app checks the entries as the registry does, and
shows the first problem it finds, e.g. "Service URL must be an https URL,
e.g. https://example.org/."; nothing is sent until you correct it. It
checks that:

- the required fields are filled in;
- the service, organization and documentation URLs are `http` or `https`
  URLs, without spaces (except around the service URL) or user names (e.g.
  `user@`), and the contact URL is one of these or a `mailto:` URL (an
  email address needs `mailto:`);
- the service URL has a scheme that the registry allows, and the
  environment is one that it allows, as it publishes them in its service
  info;
- no field is longer than the registry allows: 2048 characters for URLs,
  1024 for names, 4096 for the description and 256 for the version, the
  environment and the parts of the type (see the registry's [API
  docs](https://cloud-registry.readthedocs.io/en/latest/api/#registrations)).

If the app can't read the registry's rules (e.g. registries older than
cloud-registry 1.0.0rc2, or while they are loading), it leaves the schemes and
environments to the registry.

The registry checks the entries again: e.g. a service with the same URL and
type as a registered one is refused as a duplicate, and the message links
to that service if you may see it. If it refuses a registration, the
message says why; correct the entry and try again.

A new type is added with the service. In some deployments, new types of
users other than admins are pending until an admin approves them, and so are
the services that have them (see [Pending entries](pending.md)); the form
says so above its fields. If you may not add types, the form offers only the
registered ones; so it does for users other than admins if the registry
lets them have no unused types (limit 0, see [Service
types](browsing.md#service-types)).

### Known limitations

The form comes from [Cloud
Components](https://github.com/elixir-cloud-aai/cloud-components). It shows
problems only when you select **Create Service**, one at a time, as a
message, and doesn't mark the field; problems that only the registry finds
(e.g. a host name that isn't valid) are shown as the registry words them.
Checks while typing, and marking the fields with problems, are planned
([#132](https://github.com/elixir-cloud-aai/cloud-registry-ui/issues/132)).

## Limit on registered services

A registry can limit how many services each user may register. At the
limit, the app doesn't register another service and says: "You have
registered as many services as this registry allows (N)", with the number
of services allowed. Delete a service you no longer need, or ask the
registry's admins.

The limit is set by the registry (`custom.access_control.max_services_per_user`,
50 by default) and published in its service info
(`registrationRules.maxServicesPerUser`, from cloud-registry 1.0.0rc2). If it
is 0, only admins can
register services; an admin who is not in admin mode is told to switch to
admin mode first (see [Admin mode](admin-mode.md)). Registries older than
cloud-registry 1.0.0rc1 have no limit.

## Editing a service

Owners and maintainers of a service, and admins, can edit it:

1. Open the service (from the list, or its page) and select **Edit**.
2. Change the fields. The **Service Type** is chosen from the registered
   types, as in the form for new services; the service's current type is
   always offered, also if it isn't listed (e.g. a pending one). If you may
   add types, **Add new service type** shows the fields **Type Group**,
   **Type Artifact** and **Type Version** for a new one. The environment is
   chosen from those that the registry allows, as it publishes them in its
   service info (any text if it allows any environment), and the service
   URL must have a scheme that it allows (e.g. `https`).
3. Select **Submit**. **Reset** undoes your changes.

If you leave the page with unsaved changes, the app asks first.

![The form for editing services](../images/edit-service.png)

Some changes have consequences:

- **URL or API:** changing the URL, or the type's group or artifact,
  removes the service's verification (see
  [Verifications](verifications.md)); changing it back doesn't restore it.
- **New type:** a type that isn't registered yet is added, if you may add
  types; it may be pending until an admin approves it, and the service
  with it (the form says so). A pending service can only be changed to an
  approved type, so the form offers no new type for it, nor if it can't
  tell whether the service is pending (admins excepted).
- **Service ID:** only admins can change it. The service keeps its roles
  and its verification under the new ID, but links to the old ID stop
  working.

If the new URL and type are those of another registered service, the
registry refuses the change as a duplicate, and the message shows that
service.

## Deleting a service

Owners of a service, and admins, can delete it: open the service and
select **Delete**. The service is deleted at once, with its roles and its
verification, and can't be restored.
