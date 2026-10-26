
import type {
  CloudRegistryProvider,
  ExternalService,
  ExternalServiceRegister,
  Service,
  ServiceType,
} from "@elixir-cloud/cloud-registry/providers";

import type {
  ApiError,
  Approvals,
  CloudRegistryProviderOptions,
  GroupName,
  GroupPermission,
  Me,
  Permission,
  PermissionRegister,
  ServiceId,
  ServicePermissions,
  ServiceRole,
  ServiceVerification,
  UserId,
  Verification,
  VerificationRegister,
  VerifiedServices,
} from "./cloud-registry.types";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

// Whether the registries (by base URL) have GET /approvals, for the
// providers of all pages; see `hasApprovals`.
const approvalsSupport = new Map<string, Promise<boolean>>();

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  authenticated?: boolean;
}

class AuthenticatedCloudRegistryProvider
  implements CloudRegistryProvider
{
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor(options: CloudRegistryProviderOptions);
  constructor(baseUrl: string, token?: string);
  constructor(
    optionsOrUrl: CloudRegistryProviderOptions | string,
    token?: string,
  ) {
    const options =
      typeof optionsOrUrl === "string"
        ? { baseUrl: optionsOrUrl, token }
        : optionsOrUrl;

    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.token = options.token;
  }

  /** Whether requests can be authenticated, i.e. the user is logged in. */
  get isAuthenticated(): boolean {
    return !!this.token;
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
   * Probe for GET /approvals (cloud-registry 0.5.0 and later). Not a
   * registry operation. Only support is kept, until the page is reloaded:
   * registries without it are asked again by each page, e.g. once an
   * upgrade has rolled out.
   *
   * Sent without a token on purpose, and so not by `request()`, which
   * would add it on a 401: without one, browsers send no CORS preflight
   * and can read the status, 401 from registries with approvals and 404
   * from older ones. With a token, browsers reject the preflight's 404,
   * and the request fails without a status.
   *
   * @returns false if the route is missing (404), true for any other status
   * (e.g. 401 or 5xx; the request with the token then reports errors)
   * @throws TypeError if the registry can't be reached, or an error if it
   * doesn't answer within 10 seconds
   */
  async hasApprovals(): Promise<boolean> {
    let support = approvalsSupport.get(this.baseUrl);
    if (!support) {
      support = fetch(this.url("/approvals"), {
        cache: "no-store",
        // a stalled probe must not hold up the pages until a reload
        signal: AbortSignal.timeout(10_000),
      }).then(
        (response) => {
          const found = response.status !== 404;
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
   * PUT /services/{serviceId}/permissions/{userId}
   * Authenticated.
   *
   * Grant a role to a user.
   */
  async grantServicePermission(
    serviceId: ServiceId,
    userId: UserId,
    permission: PermissionRegister,
  ): Promise<Permission> {
    return this.request(
      `/services/${this.idPath(serviceId)}/permissions/${this.idPath(userId)}`,
      {
        method: "PUT",
        body: permission,
        authenticated: true,
      },
    );
  }

  /**
   * DELETE /services/{serviceId}/permissions/{userId}
   * Authenticated.
   *
   * Revoke a user's permission.
   */
  async revokeServicePermission(
    serviceId: ServiceId,
    userId: UserId,
  ): Promise<UserId> {
    return this.request(
      `/services/${this.idPath(serviceId)}/permissions/${this.idPath(userId)}`,
      {
        method: "DELETE",
        authenticated: true,
      },
    );
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
      `/services/${this.idPath(serviceId)}/permissions/groups/${this.idPath(group)}`,
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
      `/services/${this.idPath(serviceId)}/permissions/groups/${this.idPath(group)}`,
      {
        method: "DELETE",
        authenticated: true,
      },
    );
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
  // Registry information
  // --------------------------------------------------

  /**
   * GET /service-info
   * Public.
   */
  async getServiceInfo(): Promise<Service> {
    return this.request("/service-info");
  }
}

export { AuthenticatedCloudRegistryProvider };
