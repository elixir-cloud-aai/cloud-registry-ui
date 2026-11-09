import type { ExternalToast } from "sonner";
import type { FieldError } from "./cloud-registry.types";
import {
    hasStatus,
    isConflict,
    isForbidden,
    isUnauthorized,
} from "./permissions";

// labels of the create and edit forms, by field path
const fieldLabels: Record<string, string> = {
    id: "Service ID",
    name: "Service Name",
    url: "Service URL",
    "organization.name": "Organization Name",
    "organization.url": "Organization URL",
    "type.group": "Type Group",
    "type.artifact": "Type Artifact",
    "type.version": "Type Version",
    version: "Service Version",
    organization: "Organization",
    type: "Service Type",
    environment: "Environment",
    description: "Description",
    contactUrl: "Contact URL",
    documentationUrl: "Documentation URL",
    createdAt: "Created At",
    updatedAt: "Updated At",
};

// where the registry names a field: "'<path>' must ..." (cloud-registry),
// "URLs in '<path>' ..." (FOCA) and "... - '<path>'" (Connexion)
const fieldPaths = [
    /^()'([\w.]+)'( must )/,
    /(URLs in )'([\w.]+)'()/,
    /( - )'([\w.]+)'()$/,
];

// JSON Pointers into the request's body, as cloud-registry 1.0.0rc2 names
// fields in its detail: "'#/<a>/<b>': <message>", joined by "; "; global,
// for `replace()` and `matchAll()` only (`test()` and `exec()` would keep
// their position)
const fieldPointers = /'(#[^']*)'/g;

/**
 * Get the invalid fields of a failed request (`errors` of the registry's
 * `400` responses, as of cloud-registry 1.0.0rc2)
 * @param value Member `errors` of the response's body
 * @returns The well-formed ones, with a message and a location; undefined
 * without a list
 */
function invalidFields(value: unknown): FieldError[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.flatMap((item): FieldError[] => {
        if (item === null || typeof item !== "object") return [];
        const { detail, pointer, parameter, code } = item as Record<
            string,
            unknown
        >;
        if (typeof detail !== "string") return [];
        if (typeof pointer !== "string" && typeof parameter !== "string")
            return [];
        return [
            {
                detail,
                ...(typeof pointer === "string" ? { pointer } : {}),
                ...(typeof parameter === "string" ? { parameter } : {}),
                ...(typeof code === "string" ? { code } : {}),
            },
        ];
    });
}

/**
 * Get the path of a field from a JSON Pointer into the request's body
 * @param pointer E.g. `#/organization/url`
 * @returns E.g. `organization.url`; undefined for the body itself and
 * pointers that aren't valid
 */
function pointerPath(pointer: string) {
    if (!pointer.startsWith("#/")) return undefined;
    let decoded: string;
    try {
        // a URI fragment (RFC 6901, section 6)
        decoded = decodeURIComponent(pointer.slice(2));
    } catch {
        return undefined;
    }
    return decoded
        .split("/")
        .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
        .join(".");
}

/** Name the fields in a registry message by their form labels */
function withFieldLabels(message: string) {
    const labelled = message.replace(
        fieldPointers,
        (match, pointer: string) => {
            const path = pointerPath(pointer);
            return path !== undefined && Object.hasOwn(fieldLabels, path)
                ? `'${fieldLabels[path]}'`
                : match;
        },
    );
    return fieldPaths.reduce(
        (val, pattern) =>
            val.replace(
                pattern,
                (match, before: string, path: string, after: string) =>
                    Object.hasOwn(fieldLabels, path)
                        ? `${before}'${fieldLabels[path]}'${after}`
                        : match,
            ),
        labelled,
    );
}

const syncUrlLockedMessage =
    "This service is kept in sync with its service info, so its URL can't change. To move it, turn sync off on the service's page, or import and register it anew.";

const duplicateMessage =
    "A service with this URL and API type is already registered.";

// the registry's codes for the conflicts (409) that the UI tells apart, as of
// cloud-registry 0.5.0 (renames: 0.6.0; invitations: 1.0.0); others (e.g.
// `pending-service`, `conflict` or codes added later) show the registry's
// detail
type ConflictCode =
    | "duplicate-service"
    | "unused-types-limit"
    | "service-type-registered"
    | "service-type-in-use"
    | "verification-mismatch"
    | "last-owner"
    | "service-id-taken"
    | "service-busy"
    | "services-limit"
    | "invitations-limit"
    | "invitation-accepted"
    | "sync-unavailable"
    | "sync-identity-mismatch"
    | "sync-url-locked";

// for registries that send no code (cloud-registry#247): the detail of the
// 409 for changes of pending services (see `@/lib/approvals`) to types that
// aren't approved; any other 409 of a change is a duplicate; drop it once
// all registries send codes
const pendingDetail =
    "The service has a service type that is pending until an admin approves it; until then, it can only be updated to an approved type, or deleted.";

/** Get the registry's detail for a failed request, if any */
function errorDetail(err: unknown) {
    return err instanceof Error &&
        "detail" in err &&
        typeof err.detail === "string"
        ? err.detail
        : undefined;
}

/** Check if the registry didn't answer a request in time */
function isTimedOut(err: unknown) {
    return err instanceof Error && "timedOut" in err && err.timedOut === true;
}

/**
 * Say how long to wait after too many requests (429)
 * @param err Error of the request
 * @returns E.g. "Please try again in about 5 minutes."; without a wait from
 * the registry (`Retry-After`), to try again later
 */
function retryAfterText(err: unknown) {
    const seconds =
        err instanceof Error &&
        "retryAfter" in err &&
        typeof err.retryAfter === "number"
            ? err.retryAfter
            : undefined;
    if (seconds === undefined) return "Please try again later.";
    if (seconds < 60)
        return `Please try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
    const minutes = Math.ceil(seconds / 60);
    return `Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/**
 * Get the form's field at a path, or the first one of an object
 * @param path Path of the field, e.g. `type` or `organization.url`
 * @param fields Paths of the form's fields
 * @returns The field, if the form has it
 */
function formField<T extends string>(path: string, fields: readonly T[]) {
    return (
        fields.find((field) => field === path) ??
        fields.find((field) => field.startsWith(`${path}.`))
    );
}

/**
 * Get the form field that a registry's detail names, for registries that
 * don't list the invalid fields (before cloud-registry 1.0.0rc2)
 * @param detail The registry's detail
 * @param fields Paths of the form's fields
 * @returns The first field that the detail names, if any
 */
function detailField<T extends string>(detail: string, fields: readonly T[]) {
    const paths = [
        ...fieldPaths.map((pattern) => detail.match(pattern)?.[2]),
        ...Array.from(detail.matchAll(fieldPointers), (match) =>
            pointerPath(match[1]),
        ),
    ];
    return paths
        .map((path) =>
            path === undefined ? undefined : formField(path, fields),
        )
        .find((field) => field !== undefined);
}

/**
 * Get the form's fields that the registry rejected, each with its message:
 * from the invalid fields that the registry lists (`errors`, as of
 * cloud-registry 1.0.0rc2); if it lists none of the form's fields, or no
 * list (older registries), the field that its detail names, with the detail
 * @param err Error of the request
 * @param fields Paths of the form's fields
 * @returns The fields and their messages, the first message of each field;
 * fields that the form doesn't have, and parameters, are left out (the
 * detail names them)
 */
function fieldErrors<T extends string>(
    err: unknown,
    fields: readonly T[],
): { field: T; message: string }[] {
    const invalid =
        err instanceof Error && "errors" in err
            ? invalidFields(err.errors)
            : undefined;
    const found = new Map<T, string>();
    for (const { detail, pointer } of invalid ?? []) {
        const path = pointer === undefined ? undefined : pointerPath(pointer);
        const field = path === undefined ? undefined : formField(path, fields);
        if (field !== undefined && !found.has(field)) found.set(field, detail);
    }
    if (found.size)
        return Array.from(found, ([field, message]) => ({ field, message }));
    const detail = errorDetail(err);
    const field =
        detail === undefined ? undefined : detailField(detail, fields);
    return field === undefined || detail === undefined
        ? []
        : [{ field, message: withFieldLabels(detail) }];
}

/** Get the registry's detail for a failed request, else the fallback */
function errorMessage(err: unknown, fallback: string) {
    const detail = errorDetail(err);
    return detail === undefined ? fallback : withFieldLabels(detail);
}

// the messages for the conflicts of service types, by the registry's code;
// registries send these codes since cloud-registry 0.5.0, so older ones show
// their detail
const serviceTypeConflicts = {
    // also of registrations and changes of services with new types
    "unused-types-limit":
        "You have added as many service types that no service has as this registry allows. Register services with them, or ask an admin to remove those you don't need, before you add others.",
    "service-type-registered":
        "This service type is already registered. If you can't find it, it may be pending until an admin approves it.",
    "service-type-in-use":
        "Services have this service type, so it can't be removed. Change the type of these services, or delete them, first.",
} satisfies Partial<Record<ConflictCode, string>>;

/**
 * Get the message for a conflict of service types
 * @param err Error of the request
 * @returns The message, if the request failed with a conflict of service
 * types (`unused-types-limit`, `service-type-registered` or
 * `service-type-in-use`)
 */
function serviceTypeConflict(err: unknown) {
    const code = conflictCode(err);
    return code !== undefined && Object.hasOwn(serviceTypeConflicts, code)
        ? serviceTypeConflicts[code as keyof typeof serviceTypeConflicts]
        : undefined;
}

/**
 * Get the message for a failed change: login, role, busy, conflicts of
 * service types, detail or fallback
 */
function mutationError(
    err: unknown,
    fallback: string,
    forbidden = "You don't have permission to change this service.",
) {
    if (isUnauthorized(err))
        return "Your session expired. Please log in again.";
    if (isForbidden(err)) return forbidden;
    if (isServiceBusy(err))
        return "The service is being changed by another request. Please try again in a moment.";
    if (isSyncUrlLocked(err)) return syncUrlLockedMessage;
    return serviceTypeConflict(err) ?? errorMessage(err, fallback);
}

/**
 * Get the registry's code for a conflict
 * @param err Error of the request
 * @returns The code, if the request failed with a conflict (409) that has
 * one
 */
function conflictCode(err: unknown) {
    return isConflict(err) &&
        err instanceof Error &&
        "code" in err &&
        typeof err.code === "string"
        ? err.code
        : undefined;
}

/**
 * Check if a request failed with a conflict of a kind
 * @param err Error of the request
 * @param expected The registry's code for the conflict
 * @param legacy Check by detail for registries that send no code (default:
 * any 409)
 */
function isConflictOf(
    err: unknown,
    expected: ConflictCode,
    legacy: (detail?: string) => boolean = () => true,
) {
    if (!isConflict(err)) return false;
    const code = conflictCode(err);
    return code === undefined ? legacy(errorDetail(err)) : code === expected;
}

/** Check if a change failed as it duplicates a registered service */
function isDuplicate(err: unknown): err is Error {
    return (
        err instanceof Error &&
        isConflictOf(
            err,
            "duplicate-service",
            (detail) => detail !== pendingDetail,
        )
    );
}

/** Check if a verification failed as the service changed after the check */
function isVerificationMismatch(err: unknown) {
    return isConflictOf(err, "verification-mismatch");
}

/** Check if a change of access failed as it removes the last owner */
function isLastOwner(err: unknown) {
    return isConflictOf(err, "last-owner");
}

/** Check if a rename failed as a service with the new ID is registered */
function isServiceIdTaken(err: unknown) {
    // registries that rename services send codes
    return isConflictOf(err, "service-id-taken", () => false);
}

/** Check if a change failed as the service is being renamed or changed */
function isServiceBusy(err: unknown) {
    return isConflictOf(err, "service-busy", () => false);
}

/** Check if turning on a sync failed as it isn't available for the service */
function isSyncUnavailable(err: unknown) {
    return isConflictOf(err, "sync-unavailable", () => false);
}

/** Check if turning on a sync failed as the service info is of another service */
function isSyncIdentityMismatch(err: unknown) {
    return isConflictOf(err, "sync-identity-mismatch", () => false);
}

/** Check if a change failed as sync is on, and the URL can't change then */
function isSyncUrlLocked(err: unknown) {
    return isConflictOf(err, "sync-url-locked", () => false);
}

/** Check if a registration failed as the user has as many as allowed */
function isServicesLimit(err: unknown) {
    // registries with the limit (cloud-registry 1.0.0) send codes
    return isConflictOf(err, "services-limit", () => false);
}

// registries with invitations send codes: no check by detail

/** Check if an invitation failed as the service has as many as allowed */
function isInvitationsLimit(err: unknown) {
    return isConflictOf(err, "invitations-limit", () => false);
}

/** Check if an invitation was accepted already */
function isInvitationAccepted(err: unknown) {
    return isConflictOf(err, "invitation-accepted", () => false);
}

/** Get the message for a failed change of a service's ID */
function renameError(err: unknown) {
    if (isServiceIdTaken(err))
        return "A service with this ID is already registered. Please choose another ID.";
    // registries before cloud-registry 0.6.0 have no renames
    if (hasStatus(err, 405)) return "This registry can't change service IDs.";
    if (hasStatus(err, 404))
        return "The service was deleted, or this registry can't change service IDs.";
    return mutationError(
        err,
        "Cannot change the service ID currently.",
        "Only admins can change service IDs.",
    );
}

/** Get the toast for a change that duplicates a registered service */
function duplicateToast(
    err: unknown,
): (ExternalToast & { message: string }) | null {
    if (!isDuplicate(err)) return null;

    const serviceId =
        "serviceId" in err && typeof err.serviceId === "string"
            ? err.serviceId
            : "";
    // the registry names the service only to users who may read it
    if (!serviceId)
        return {
            message:
                "A service with this URL and API type is already registered; contact an admin.",
        };

    return {
        message: errorMessage(err, duplicateMessage),
        description: "Please contact its owner or an admin.",
        // a new tab keeps the form's input
        action: {
            label: "View service",
            onClick: () =>
                window.open(
                    `/dashboard/services/view/${encodeURIComponent(serviceId)}`,
                    "_blank",
                    "noopener",
                ),
        },
        duration: 10000,
    };
}

/**
 * Get the toast for a refused change of the registry's listing among its own
 * services (`PUT` and `DELETE /service-info/listing`). The registry says why
 * in its detail, e.g. that its environment isn't allowed
 * @param err Error of the request
 * @param fallback Message if the registry gives no reason
 * @returns The toast
 */
function selfListingError(
    err: unknown,
    fallback: string,
): ExternalToast & { message: string } {
    const duplicate = duplicateToast(err);
    if (duplicate)
        return {
            ...duplicate,
            message: errorMessage(err, duplicateMessage),
            description:
                "The registry's entry doesn't take it over: delete that service first.",
        };
    if (hasStatus(err, 404))
        return {
            message: "The registry's entry was removed by another request.",
        };
    return {
        message: mutationError(
            err,
            fallback,
            "Only admins can add or remove the registry.",
        ),
    };
}

export {
    duplicateMessage,
    duplicateToast,
    errorDetail,
    errorMessage,
    fieldErrors,
    invalidFields,
    isDuplicate,
    isInvitationAccepted,
    isInvitationsLimit,
    isLastOwner,
    isServiceBusy,
    isServiceIdTaken,
    isServicesLimit,
    isSyncIdentityMismatch,
    isSyncUnavailable,
    isSyncUrlLocked,
    isTimedOut,
    isVerificationMismatch,
    mutationError,
    renameError,
    retryAfterText,
    selfListingError,
    serviceTypeConflict,
    syncUrlLockedMessage,
    withFieldLabels,
};
