
import type {
  ExternalService,
  ExternalServiceRegister,
  Service,
  ServiceRegister,
  ServiceType,
  ServiceTypeRegister,
} from "@elixir-cloud/cloud-registry/providers";

/** Roles available on a registry service. */
export type Role = "owner" | "maintainer";

/** Identifier aliases. */
export type ServiceId = string;
export type UserId = string;
export type GroupName = string;

/**
 * A user's role on a service.
 */
export interface Permission {
  /** Display name, if known. */
  name?: string;
  role: Role;
  /** User identifier (token sub). */
  user_id: UserId;
}

/**
 * Role of a group on a service.
 */
export interface GroupPermission {
  /** Value of the group claim of the members' tokens. */
  group: GroupName;
  role: Role;
}

/** Request body for granting a user's or group's permission. */
export interface PermissionRegister {
  role: Role;
}

/**
 * Current user's role on a service.
 */
export interface ServiceRole {
  /** Present when the role was granted to a group. */
  group?: string;
  role: Role;
  service_id: ServiceId;
}

/**
 * GET /me
 */
export interface Me {
  admin: boolean;
  services: ServiceRole[];
  user_id: UserId;
}

/**
 * GET /services/{serviceId}/permissions
 *
 * Roles of users and groups, together.
 */
export type ServicePermissions = (Permission | GroupPermission)[];

/**
 * GET /services/{serviceId}/verification
 * GET /verifications
 */
export interface Verification {
  type: ServiceType;
  url: string;
  verified_at: string;
}

/**
 * Verification of a service with its identifier.
 */
export interface ServiceVerification extends Verification {
  service_id: ServiceId;
}

/**
 * PUT /services/{serviceId}/verification
 */
export interface VerificationRegister {
  type: ServiceTypeRegister;
  url: string;
}

/**
 * GET /verifications
 *
 * Assumes the endpoint returns verified service records.
 */
export type VerifiedServices = ServiceVerification[];

/** API error response. */
export interface ApiError {
  title?: string;
  detail?: string;
  message?: string;
  serviceId?: string;
}

/** Provider configuration. */
export interface CloudRegistryProviderOptions {
  baseUrl: string;
  token?: string;
}

export type {
  ExternalService,
  ExternalServiceRegister,
  Service,
  ServiceRegister,
  ServiceType,
  ServiceTypeRegister,
};
