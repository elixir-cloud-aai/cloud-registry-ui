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
    /** User identifier (token sub); may contain slashes. */
    userId: UserId;
}

/**
 * Role of a group on a service.
 */
export interface GroupPermission {
    /** Value of the group claim of the members' tokens. */
    group: GroupName;
    role: Role;
}

/**
 * PUT /services/{serviceId}/permissions/users/{userId}
 * PUT /services/{serviceId}/permissions/groups/{group}
 *
 * Request body for granting a user's or group's permission.
 */
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
    serviceId: ServiceId;
}

/**
 * GET /me
 */
export interface Me {
    /** Whether the user acts as an admin on this request (admin mode). */
    admin: boolean;
    /**
     * Whether the user may switch to admin mode (cloud-registry#240); missing
     * in registries without admin mode.
     */
    adminAvailable?: boolean;
    /** Whether the caller may add service types (cloud-registry#235). */
    mayAddServiceTypes?: boolean;
    /** Whether the types the caller adds are pending (cloud-registry#238). */
    serviceTypesPending?: boolean;
    services: ServiceRole[];
    userId: UserId;
}

/**
 * GET /services/{serviceId}/permissions
 *
 * Roles of users and groups, together.
 */
export type ServicePermissions = (Permission | GroupPermission)[];

/**
 * Who accepted an invitation, and when (cloud-registry#101).
 */
export interface InvitationAcceptance {
    userId: UserId;
    /** Display name, if the identity provider released it. */
    name?: string;
    /** Email address, if the identity provider released it. */
    email?: string;
    /** RFC 3339 date-time. */
    acceptedAt: string;
}

/** Status of an invitation; accepted ones are only listed if asked for. */
export type InvitationStatus = "open" | "expired" | "accepted";

/**
 * POST /services/{serviceId}/invitations
 *
 * The role of a new invitation, and what it is for.
 */
export interface InvitationRegister {
    role: Role;
    /** Plain text: one line, at most 100 characters. Never show it as markup. */
    label?: string;
}

/**
 * GET /services/{serviceId}/invitations
 *
 * An invitation to a service, without its token.
 */
export interface Invitation {
    id: string;
    serviceId: ServiceId;
    role: Role;
    /** Not set if none was given, and by cloud-registry up to 1.0.0rc1. */
    label?: string;
    /** Not set by cloud-registry up to 1.0.0rc1. */
    status?: InvitationStatus;
    /** Identifier of the user who created it. */
    createdBy: UserId;
    /** RFC 3339 date-time. */
    createdAt: string;
    /** RFC 3339 date-time; it can no longer be accepted then. */
    expiresAt: string;
    /** Not set for open invitations. */
    accepted?: InvitationAcceptance;
}

/**
 * POST /services/{serviceId}/invitations
 *
 * A new invitation, with its token, which only this response has.
 */
export interface InvitationCreated extends Omit<Invitation, "accepted"> {
    token: string;
}

/**
 * GET /services/{serviceId}/verification
 * GET /verifications
 */
export interface Verification {
    type: ServiceType;
    url: string;
    verifiedAt: string;
}

/**
 * Verification of a service with its identifier.
 */
export interface ServiceVerification extends Verification {
    serviceId: ServiceId;
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

/** Why a service is out of sync, if the last sync failed. */
export type SyncReason =
    | "unreachable"
    | "address not allowed"
    | "invalid service info"
    | "identity mismatch"
    | "version awaiting approval"
    | "version not allowed"
    | "unused types limit reached";

/**
 * PUT /services/{serviceId}/sync
 *
 * The state of a service's sync with its service info.
 */
export interface ServiceSync {
    url: string;
    type: ServiceType;
    /** As the registry computes it; no sync at all is a 404. */
    status: "synced" | "out-of-sync";
    /** `id` of the service info when sync was turned on. */
    serviceInfoId: string;
    /** Why the last sync failed; out of sync without one: syncs aren't running. */
    reason?: SyncReason;
    /** RFC 3339 date-time. */
    lastAttemptAt?: string;
    /** RFC 3339 date-time. */
    lastSuccessAt?: string;
}

/**
 * GET /syncs
 *
 * The state of a sync with the service's identifier.
 */
export interface ServiceSyncState extends ServiceSync {
    serviceId: ServiceId;
}

/**
 * Something that needs the attention of a user (`GET /notifications`).
 * `id` is opaque: an item may come back under the same one. The registry may
 * add types, which `notificationView()` also handles.
 */
export interface AppNotification {
    id: string;
    type:
        | "out-of-sync"
        | "pending-service-type"
        | "pending-service"
        | "environment-not-allowed"
        | "url-scheme-not-allowed";
    reason: string;
    serviceId?: ServiceId;
    /** Only for `pending-service-type` */
    serviceType?: ServiceType;
    since?: string;
}

/**
 * GET /approvals
 *
 * Pending service types and services that the caller may see.
 */
export interface Approvals {
    serviceTypes: ServiceType[];
    services: ExternalService[];
}

/**
 * GET, PUT and DELETE /service-info/listing
 *
 * Whether the registry is listed among its own services, as the client keeps
 * it (the fields of the API are read in `AuthenticatedCloudRegistryProvider`).
 */
export interface SelfListing {
    listed: boolean;
    /** Identifier of the registry's entry, if it is listed. */
    serviceId?: ServiceId;
}

/** API error response. */
export interface ApiError {
    title?: string;
    detail?: string;
    message?: string;
    /** Kind of a conflict (409). */
    code?: string;
    serviceId?: string;
}

/** Provider configuration. */
export interface CloudRegistryProviderOptions {
    baseUrl: string;
    token?: string;
    /**
     * Opt-in roles to ask for in authenticated requests, e.g. `["admin"]` for
     * admin mode (cloud-registry#240; header `X-Request-Roles`).
     */
    roles?: string[];
}

export type {
    ExternalService,
    ExternalServiceRegister,
    Service,
    ServiceRegister,
    ServiceType,
    ServiceTypeRegister,
};
