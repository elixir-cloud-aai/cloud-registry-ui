
import type {
  CloudRegistryProvider,
  ExternalService,
  ExternalServiceRegister,
  Service,
  ServiceRegister,
  ServiceType,
} from "@elixir-cloud/cloud-registry/providers";

import type {
  ApiError,
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

  // --------------------------------------------------
  // HTTP helpers
  // --------------------------------------------------

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  private idPath(id: string): string {
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
      let message = `Request failed: ${response.status} ${response.statusText}`;

      try {
        const error = (await response.json()) as ApiError;

        if (typeof error.detail === "string") {
          message = error.detail;
        } else if (typeof error.message === "string") {
          message = error.message;
        }
      } catch {
        // The error response may not contain JSON.
      }

      // Keep the status, e.g. to tell 401 from 403.
      throw Object.assign(new Error(message), {
        status: response.status,
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
  ): Promise<void> {
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
  ): Promise<void> {
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
    permission: GroupPermission,
  ): Promise<void> {
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
  ): Promise<void> {
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

  /**
   * POST /service-info
   * Authenticated.
   *
   * Create or update service info.
   */
  async createOrUpdateServiceInfo(
    service: ServiceRegister,
  ): Promise<void> {
    return this.request("/service-info", {
      method: "POST",
      body: service,
      authenticated: true,
    });
  }
}

export { AuthenticatedCloudRegistryProvider };
