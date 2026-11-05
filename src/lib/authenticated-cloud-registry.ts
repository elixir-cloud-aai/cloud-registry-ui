
import type {
  CloudRegistryProvider,
  ExternalService,
  ExternalServiceRegister,
  Service,
  ServiceType,
} from "@elixir-cloud/cloud-registry/providers";

import type {
  ApiError,
  AppNotification,
  Approvals,
  CloudRegistryProviderOptions,
  GroupName,
  GroupPermission,
  Invitation,
  InvitationCreated,
  InvitationRegister,
  Me,
  Permission,
  PermissionRegister,
  SelfListing,
  ServiceId,
  ServicePermissions,
  ServiceRole,
  ServiceSync,
  ServiceSyncState,
  ServiceVerification,
  UserId,
  Verification,
  VerificationRegister,
  VerifiedServices,
} from "./cloud-registry.types";
import { hasStatus } from "./permissions";
import { registrationRules } from "./registration-rules";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

// Whether the registries (by base URL) have GET /approvals, for the
// providers of all pages; see `hasApprovals`.
const approvalsSupport = new Map<string, Promise<boolean>>();

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  authenticated?: boolean;
}

/**
 * `.` or `..`, the whole ID or between slashes or backslashes, which browsers
 * take as slashes (`UserId` and `Group` in the registry's API)
 */
const dotSegment = /(^|[/\\])\.\.?([/\\]|$)/;

/**
 * Get the error for an answer about another user than the requested one:
 * cloud-registry 0.6.0 and 1.0.0rc1 take the paths of users' roles for those
 * of a user `users/<ID>`, and answer `200 OK`, so only the answer tells.
 * Registries return the ID from the path as it is
 * @param what What the registry did
 * @returns The error, with the message for the user
 */
function tooOldRegistry(what: string) {
  const detail = `This registry is too old for this version of the app: ${what}. Ask its admins to upgrade it; until then, this app can't change the roles of users.`;
  return Object.assign(new Error(detail), { detail });
}

class AuthenticatedCloudRegistryProvider
  implements CloudRegistryProvider
{
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly roles: string[];

  constructor(options: CloudRegistryProviderOptions);
  constructor(baseUrl: string, token?: string);
  constructor(
    optionsOrUrl: CloudRegistryProviderOptions | string,
    token?: string,
  ) {
    const options: CloudRegistryProviderOptions =
      typeof optionsOrUrl === "string"
        ? { baseUrl: optionsOrUrl, token }
        : optionsOrUrl;

    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
    this.roles = options.roles ?? [];
  }

  /** Whether requests can be authenticated, i.e. the user is logged in. */
  get isAuthenticated(): boolean {
    return !!this.token;
  }

  /**
   * Path of the services on the registry's server, under which the
   * registry grants roles, e.g. `/ga4gh/registry/v1/services`.
   */
  get servicesPath(): string {
    const path = URL.canParse(this.baseUrl)
      ? new URL(this.baseUrl).pathname.replace(/\/+$/, "")
      : "";
    // as the registry's routes have it, not percent-encoded
    try {
      return `${decodeURIComponent(path)}/services`;
    } catch {
      return `${path}/services`;
    }
  }

  // --------------------------------------------------
  // HTTP helpers
  // --------------------------------------------------

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private idPath(id: string): string {
    // encodeURIComponent leaves dots, and URLs resolve dot segments, so
    // `.` and `..` would reach other paths
    if (id === "." || id === "..") throw new Error(`Invalid ID: '${id}'`);
    return encodeURIComponent(id);
  }

  private principalPath(id: string): string {
    // the path would have a double slash, which the registry redirects to
    // that of another user or group
    if (id.startsWith("/")) {
      throw Object.assign(new Error(`Invalid ID: '${id}'`), {
        detail: `The app can't change the role of '${id}', as IDs can't start with '/'.`,
      });
    }
    // a proxy that decodes slashes would resolve them to another path
    if (dotSegment.test(id)) {
      throw Object.assign(new Error(`Invalid ID: '${id}'`), {
        detail: `The app can't change the role of '${id}', as IDs can't have the parts '.' or '..'.`,
      });
    }
    return this.idPath(id);
  }

  /**
   * Read something public with the user's token, which also shows what only
   * the user may see. The registry refuses invalid tokens, so an expired one
   * reads like a guest, as the other public reads do. If that fails as well,
   * the expired login is the error: a 404 may only mean that guests can't see
   * it, e.g. for a pending service.
   */
  private async readAsUser<T>(path: string): Promise<T> {
    try {
      return await this.request<T>(path, {
        authenticated: this.isAuthenticated,
      });
    } catch (err) {
      if (!this.isAuthenticated || !hasStatus(err, 401)) throw err;
      try {
        return await this.request<T>(path);
      } catch {
        throw err;
      }
    }
  }

  /**
   * Shared HTTP request handler.
   *
   * Public endpoints do not receive Authorization.
   * Authenticated endpoints require a bearer token.
   */
  private async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const {
      method = "GET",
      body,
      authenticated = false,
    } = options;

    const headers = new Headers();

    if (body !== undefined) {
      headers.set("Content-Type", "application/json");
    }

    if (authenticated) {
      if (!this.token) {
        throw new Error(
          "Authentication is required for this operation.",
        );
      }

      headers.set("Authorization", `Bearer ${this.token}`);
      // with the user's token only: the roles are the user's
      if (this.roles.length) {
        headers.set("X-Request-Roles", this.roles.join(","));
      }
    }

    const response = await fetch(this.url(path), {
      method,
      headers,
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
    });

    // Deployments may require login for reads: retry once with the token.
    if (response.status === 401 && !authenticated && this.token) {
      return this.request(path, { ...options, authenticated: true });
    }

    if (!response.ok) {
      let message = `Request failed: ${response.status} ${response.statusText}`.trimEnd();
      let body: ApiError = {};

      try {
        // Any content type, e.g. application/problem+json.
        body = ((await response.json()) ?? {}) as ApiError;

        if (typeof body.detail === "string") {
          message = body.detail;
        } else if (typeof body.message === "string") {
          message = body.message;
        }
      } catch {
        // The error response may not contain JSON.
      }

      // Keep the status, e.g. to tell 401 from 403, and the problem details.
      throw Object.assign(new Error(message), {
        status: response.status,
        title: body.title,
        detail: body.detail,
        code: body.code,
        serviceId: body.serviceId,
      });
    }

    // Handle endpoints that return no content.
    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type");

    if (!contentType?.includes("application/json")) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  // --------------------------------------------------
  // User
  // --------------------------------------------------

  /**
   * GET /me
   * Authenticated.
   *
   * Returns the current user and their service roles.
   */
  async getCurrentUser(): Promise<Me> {
    return this.request("/me", {
      authenticated: true,
    });
  }

  // --------------------------------------------------
  // Services
  // --------------------------------------------------

  /**
   * GET /services
   * Public.
   */
  async getServices(): Promise<ExternalService[]> {
    return this.request("/services");
  }

  /**
   * GET /services/{serviceId}
   * Public.
   */
  async getServiceById(
    serviceId: ServiceId,
  ): Promise<ExternalService> {
    return this.request(
      `/services/${this.idPath(serviceId)}`,
    );
  }

  /**
   * GET /services/types
   * Public.
   */
  async getServiceTypes(): Promise<ServiceType[]> {
    return this.request("/services/types");
  }

  /**
   * POST /services/types
   * Authenticated.
   *
   * Register a service type.
   */
  async addServiceType(serviceType: ServiceType): Promise<ServiceType> {
    return this.request("/services/types", {
      method: "POST",
      body: serviceType,
      authenticated: true,
    });
  }

  /**
   * DELETE /services/types
   * Authenticated (admins).
   *
   * Remove a service type that no service has.
   */
  async removeServiceType(serviceType: ServiceType): Promise<ServiceType> {
    const { group, artifact, version } = serviceType;
    const query = new URLSearchParams({ group, artifact, version });
    return this.request(`/services/types?${query}`, {
      method: "DELETE",
      authenticated: true,
    });
  }

  /**
   * PUT /services/types/approval
   * Authenticated (admins).
   *
   * Approve a pending service type, and so the services that have it.
   */
  async approveServiceType(serviceType: ServiceType): Promise<ServiceType> {
    const { group, artifact, version } = serviceType;
    return this.request("/services/types/approval", {
      method: "PUT",
      body: { group, artifact, version },
      authenticated: true,
    });
  }

  /**
   * GET /approvals
   * Authenticated.
   *
   * List the pending service types and services that the user may see.
   */
  async getApprovals(): Promise<Approvals> {
    return this.request("/approvals", {
      authenticated: true,
    });
  }

  /**
   * Find out whether the registry has GET /approvals (cloud-registry 0.5.0
   * and later). Not a registry operation. Only support is kept, until the
   * page is reloaded: registries without it are asked again by each page,
   * e.g. once an upgrade has rolled out.
   *
   * Registries that publish registration rules (1.0.0rc2 and later, see
   * `publishesRules`) have the route. Only for others is the route itself
   * probed, see `probeApprovals`: registries that require a login for it
   * answer that request with a 401, which browsers and the registry's log
   * report as an error.
   *
   * @returns false if the route is missing (404), true if the rules are
   * published or for any other status (e.g. 401 or 5xx; the request with
   * the token then reports errors)
   * @throws TypeError if the registry can't be reached, or an error if the
   * probe isn't answered within 10 seconds
   */
  async hasApprovals(): Promise<boolean> {
    let support = approvalsSupport.get(this.baseUrl);
    if (!support) {
      support = this.publishesRules()
        .then((rules) => rules || this.probeApprovals())
        .then(
          (found) => {
            if (!found) approvalsSupport.delete(this.baseUrl);
            return found;
          },
          (err: unknown) => {
            // ask again next time, e.g. once the registry is up
            approvalsSupport.delete(this.baseUrl);
            throw err;
          },
        );
      approvalsSupport.set(this.baseUrl, support);
    }
    return support;
  }

  /**
   * Check whether the service info has registration rules. Not by
   * `getServiceInfo()`, as this request needs a timeout of its own, so that
   * a stalled service info leaves time for the probe, and is sent without a
   * token, also on a 401: it is public, and needs no CORS preflight then.
   * Sent in addition to the read of the rules by the pages that use them,
   * as often as `hasApprovals` has to ask.
   *
   * @returns Whether it has them; false if it can't be read in 5 seconds,
   * which leaves the answer to the probe
   */
  private async publishesRules(): Promise<boolean> {
    try {
      const response = await fetch(this.url("/service-info"), {
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      return (
        response.ok && registrationRules(await response.json()) !== undefined
      );
    } catch {
      return false;
    }
  }

  /**
   * Probe for GET /approvals.
   *
   * Sent without a token on purpose, and so not by `request()`, which
   * would add it on a 401: without one, browsers send no CORS preflight
   * and can read the status, 401 from registries with approvals and 404
   * from older ones. With a token, browsers reject the preflight's 404,
   * and the request fails without a status.
   *
   * @returns false if the route is missing (404), true for any other status
   */
  private async probeApprovals(): Promise<boolean> {
    const response = await fetch(this.url("/approvals"), {
      cache: "no-store",
      // a stalled probe must not hold up the pages until a reload
      signal: AbortSignal.timeout(10_000),
    });
    return response.status !== 404;
  }

  /**
   * POST /services
   * Authenticated.
   */
  async createService(
    service: ExternalServiceRegister,
  ): Promise<string> {
    return this.request("/services", {
      method: "POST",
      body: service,
      authenticated: true,
    });
  }

  /**
   * PUT /services/{serviceId}
   * Authenticated.
   *
   * Create or update a service with a specific ID.
   */
  async createServiceWithId(
    id: ServiceId,
    service: ExternalServiceRegister,
  ): Promise<string> {
    return this.request(
      `/services/${this.idPath(id)}`,
      {
        method: "PUT",
        body: service,
        authenticated: true,
      },
    );
  }

  /**
   * PUT /services/{serviceId}
   * Authenticated.
   *
   * Update a service.
   */
  async updateService(
    id: ServiceId,
    service: ExternalServiceRegister,
  ): Promise<string> {
    return this.createServiceWithId(id, service);
  }

  /**
   * DELETE /services/{serviceId}
   * Authenticated.
   */
  async deleteService(
    id: ServiceId,
  ): Promise<string> {
    return this.request(
      `/services/${this.idPath(id)}`,
      {
        method: "DELETE",
        authenticated: true,
      },
    );
  }

  /**
   * POST /services/{serviceId}/rename
   * Authenticated (admins).
   *
   * Change the ID of a service; its roles and verification move with it.
   *
   * @param id Current ID of the service
   * @param newId New ID of the service
   * @returns Promise resolving to the new ID
   */
  async renameService(
    id: ServiceId,
    newId: ServiceId,
  ): Promise<ServiceId> {
    return this.request(
      `/services/${this.idPath(id)}/rename`,
      {
        method: "POST",
        body: { id: newId },
        authenticated: true,
      },
    );
  }

  // --------------------------------------------------
  // Permissions
  // --------------------------------------------------

  /**
   * GET /services/{serviceId}/permissions
   * Authenticated.
   *
   * List the roles of users and groups.
   */
  async getServicePermissions(
    serviceId: ServiceId,
  ): Promise<ServicePermissions> {
    return this.request(
      `/services/${this.idPath(serviceId)}/permissions`,
      {
        authenticated: true,
      },
    );
  }

  /**
   * PUT /services/{serviceId}/permissions/users/{userId}
   * Authenticated.
   *
   * Grant a role to a user.
   */
  async grantServicePermission(
    serviceId: ServiceId,
    userId: UserId,
    permission: PermissionRegister,
  ): Promise<Permission> {
    const granted = await this.request<Permission & { user_id?: UserId }>(
      `/services/${this.idPath(serviceId)}/permissions/users/${this.principalPath(userId)}`,
      {
        method: "PUT",
        body: permission,
        authenticated: true,
      },
    );
    // these registries answer with the former name of the field
    const grantee = granted?.userId ?? granted?.user_id;
    if (grantee !== undefined && grantee !== userId) {
      throw tooOldRegistry(
        `it granted the role to '${grantee}', not to '${userId}'`,
      );
    }
    return granted;
  }

  /**
   * DELETE /services/{serviceId}/permissions/users/{userId}
   * Authenticated.
   *
   * Revoke a user's permission.
   */
  async revokeServicePermission(
    serviceId: ServiceId,
    userId: UserId,
  ): Promise<UserId> {
    const revoked = await this.request<UserId>(
      `/services/${this.idPath(serviceId)}/permissions/users/${this.principalPath(userId)}`,
      {
        method: "DELETE",
        authenticated: true,
      },
    );
    if (typeof revoked === "string" && revoked !== userId) {
      throw tooOldRegistry(
        `it removed the role of '${revoked}', not of '${userId}'`,
      );
    }
    return revoked;
  }

  /**
   * PUT /services/{serviceId}/permissions/groups/{group}
   * Authenticated.
   *
   * Grant a role to a group.
   */
  async grantGroupPermission(
    serviceId: ServiceId,
    group: GroupName,
    permission: PermissionRegister,
  ): Promise<GroupPermission> {
    return this.request(
      `/services/${this.idPath(serviceId)}/permissions/groups/${this.principalPath(group)}`,
      {
        method: "PUT",
        body: permission,
        authenticated: true,
      },
    );
  }

  /**
   * DELETE /services/{serviceId}/permissions/groups/{group}
   * Authenticated.
   *
   * Revoke a group's permission.
   */
  async revokeGroupPermission(
    serviceId: ServiceId,
    group: GroupName,
  ): Promise<GroupName> {
    return this.request(
      `/services/${this.idPath(serviceId)}/permissions/groups/${this.principalPath(group)}`,
      {
        method: "DELETE",
        authenticated: true,
      },
    );
  }

  // --------------------------------------------------
  // Invitations
  // --------------------------------------------------

  /**
   * POST /services/{serviceId}/invitations
   * Authenticated (owners, admins).
   *
   * Create an invitation to a service for a role, with a label if given.
   *
   * @returns The invitation, with its token, which only this response has
   */
  async createInvitation(
    serviceId: ServiceId,
    invitation: InvitationRegister,
  ): Promise<InvitationCreated> {
    return this.request(
      `/services/${this.idPath(serviceId)}/invitations`,
      {
        method: "POST",
        body: invitation,
        authenticated: true,
      },
    );
  }

  /**
   * GET /services/{serviceId}/invitations
   * Authenticated (owners, admins).
   *
   * List the invitations that weren't accepted, also expired ones; registries
   * up to cloud-registry 1.0.0rc1 list the open and accepted ones that haven't
   * expired, without their status.
   */
  async getServiceInvitations(
    serviceId: ServiceId,
  ): Promise<Invitation[]> {
    return this.request(
      `/services/${this.idPath(serviceId)}/invitations`,
      {
        authenticated: true,
      },
    );
  }

  /**
   * DELETE /services/{serviceId}/invitations/{invitationId}
   * Authenticated (owners, admins).
   *
   * Revoke an open invitation, or remove an expired one.
   */
  async revokeInvitation(
    serviceId: ServiceId,
    invitationId: string,
  ): Promise<string> {
    return this.request(
      `/services/${this.idPath(serviceId)}/invitations/${this.idPath(invitationId)}`,
      {
        method: "DELETE",
        authenticated: true,
      },
    );
  }

  /**
   * POST /invitations/accept
   * Authenticated.
   *
   * Accept an invitation, which grants its role to the current user. The
   * token goes in the body, not in the URL, so that it stays out of logs.
   *
   * @returns The role granted on the service
   */
  async acceptInvitation(token: string): Promise<ServiceRole> {
    return this.request("/invitations/accept", {
      method: "POST",
      body: { token },
      authenticated: true,
    });
  }

  // --------------------------------------------------
  // Verification
  // --------------------------------------------------

  /**
   * GET /services/{serviceId}/verification
   * Public.
   */
  async getServiceVerification(
    serviceId: ServiceId,
  ): Promise<ServiceVerification> {
    return this.request(
      `/services/${this.idPath(serviceId)}/verification`,
    );
  }

  /**
   * PUT /services/{serviceId}/verification
   * Authenticated.
   *
   * Verify a service.
   */
  async verifyService(
    serviceId: ServiceId,
    verification: VerificationRegister,
  ): Promise<void> {
    return this.request(
      `/services/${this.idPath(serviceId)}/verification`,
      {
        method: "PUT",
        body: verification,
        authenticated: true,
      },
    );
  }

  /**
   * DELETE /services/{serviceId}/verification
   * Authenticated.
   *
   * Remove service verification.
   */
  async removeServiceVerification(
    serviceId: ServiceId,
  ): Promise<void> {
    return this.request(
      `/services/${this.idPath(serviceId)}/verification`,
      {
        method: "DELETE",
        authenticated: true,
      },
    );
  }

  /**
   * GET /verifications
   * Public.
   *
   * List verified services.
   */
  async getVerifications(): Promise<VerifiedServices> {
    return this.request("/verifications");
  }

  // --------------------------------------------------
  // Service info: import and sync
  // --------------------------------------------------

  /**
   * POST /services/import
   * Authenticated.
   *
   * Have the registry fetch a service info, without a token. Stores nothing.
   *
   * @param serviceInfoUrl Address of the service-info endpoint
   * @returns The values for a registration
   */
  async importServiceInfo(
    serviceInfoUrl: string,
  ): Promise<ExternalServiceRegister> {
    return this.request("/services/import", {
      method: "POST",
      body: { serviceInfoUrl },
      authenticated: true,
    });
  }

  /**
   * PUT /services/{serviceId}/sync
   * Authenticated (owners, maintainers, admins).
   *
   * Turn on the sync of a service with its service info, or sync it now.
   * Nothing changes if the request fails.
   *
   * @returns The state of the sync; values that can't be applied are a
   * `reason` in it, not an error
   */
  async syncService(serviceId: ServiceId): Promise<ServiceSync> {
    return this.request(
      `/services/${this.idPath(serviceId)}/sync`,
      {
        method: "PUT",
        authenticated: true,
      },
    );
  }

  /**
   * DELETE /services/{serviceId}/sync
   * Authenticated (owners, maintainers, admins).
   *
   * Turn off the sync of a service, which keeps its values.
   */
  async removeServiceSync(serviceId: ServiceId): Promise<ServiceId> {
    return this.request(
      `/services/${this.idPath(serviceId)}/sync`,
      {
        method: "DELETE",
        authenticated: true,
      },
    );
  }

  /**
   * GET /services/{serviceId}/sync
   * Public; with the user's token if logged in, as pending services show
   * their sync only to those who may see them.
   *
   * @returns The state of the sync; fails with a 404 without one
   */
  async getServiceSync(serviceId: ServiceId): Promise<ServiceSync> {
    return this.readAsUser(`/services/${this.idPath(serviceId)}/sync`);
  }

  /**
   * GET /syncs
   * Public; with the user's token if logged in.
   *
   * List the states of all services with sync, e.g. for the labels of a list;
   * none if the deployment doesn't sync.
   */
  async getSyncs(): Promise<ServiceSyncState[]> {
    return this.readAsUser("/syncs");
  }

  // --------------------------------------------------
  // Notifications
  // --------------------------------------------------

  /**
   * GET /notifications
   * Authenticated.
   *
   * What needs the user's attention, most recent first; in admin mode, what
   * needs the attention of admins.
   */
  async getNotifications(): Promise<AppNotification[]> {
    return this.request("/notifications", { authenticated: true });
  }

  /**
   * DELETE /notifications/{notificationId}
   * Authenticated.
   *
   * Dismiss a notification for all who see it, until the problem ends and
   * comes back, or its reason changes.
   */
  async dismissNotification(notificationId: string): Promise<string> {
    return this.request(`/notifications/${this.idPath(notificationId)}`, {
      method: "DELETE",
      authenticated: true,
    });
  }

  // --------------------------------------------------
  // Registry information
  // --------------------------------------------------

  /**
   * GET /service-info
   * Public.
   */
  async getServiceInfo(): Promise<Service> {
    return this.request("/service-info");
  }

  /**
   * GET, PUT or DELETE /service-info/listing
   * Authenticated (admins).
   *
   * The only place that knows the API's field for the identifier.
   */
  private async selfListing(method: HttpMethod): Promise<SelfListing> {
    const state = await this.request<
      { listed?: unknown; serviceId?: unknown } | undefined
    >("/service-info/listing", { method, authenticated: true });
    if (typeof state?.listed !== "boolean") {
      throw new Error("The registry's answer doesn't say whether it is listed.");
    }
    return {
      listed: state.listed,
      ...(typeof state.serviceId === "string"
        ? { serviceId: state.serviceId }
        : {}),
    };
  }

  /** Tell whether the registry is listed among its services. */
  async getSelfListing(): Promise<SelfListing> {
    return this.selfListing("GET");
  }

  /** Add the registry to its services, or bring its entry up to date. */
  async addSelfListing(): Promise<SelfListing> {
    return this.selfListing("PUT");
  }

  /** Remove the registry from its services. */
  async removeSelfListing(): Promise<SelfListing> {
    return this.selfListing("DELETE");
  }
}

export { AuthenticatedCloudRegistryProvider, dotSegment };
