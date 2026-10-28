import type { ExternalToast } from "sonner";
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

/** Name the fields in a registry message by their form labels */
function withFieldLabels(message: string) {
    return fieldPaths.reduce(
        (val, pattern) =>
            val.replace(
                pattern,
                (match, before: string, path: string, after: string) =>
                    Object.hasOwn(fieldLabels, path)
                        ? `${before}'${fieldLabels[path]}'${after}`
                        : match,
            ),
        message,
    );
}

const duplicateMessage =
    "A service with this URL and API type is already registered.";

// the registry's codes for the conflicts (409) that the UI tells apart, as of
// cloud-registry 0.5.0 (renames: 0.6.0); others (e.g. `pending-service`,
// `conflict` or codes added later) show the registry's detail
type ConflictCode =
    | "duplicate-service"
    | "verification-mismatch"
    | "last-owner"
    | "service-id-taken"
    | "service-busy";

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

/**
 * Get the form field that the registry's detail for a failed request names
 * @param err Error of the request
 * @param fields Paths of the form's fields
 * @returns The field's path, if the detail names one of the fields
 */
function errorField<T extends string>(err: unknown, fields: readonly T[]) {
    const detail = errorDetail(err);
    if (detail === undefined) return undefined;
    return fieldPaths
        .map((pattern) => detail.match(pattern)?.[2])
        .find((path): path is T => fields.includes(path as T));
}

/** Get the registry's detail for a failed request, else the fallback */
function errorMessage(err: unknown, fallback: string) {
    const detail = errorDetail(err);
    return detail === undefined ? fallback : withFieldLabels(detail);
}

/** Get the message for a failed change: login, role, busy, detail or fallback */
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
    return errorMessage(err, fallback);
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
    const code =
        err instanceof Error && "code" in err && typeof err.code === "string"
            ? err.code
            : undefined;
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

export {
    duplicateMessage,
    duplicateToast,
    errorField,
    errorMessage,
    isDuplicate,
    isLastOwner,
    isServiceBusy,
    isServiceIdTaken,
    isVerificationMismatch,
    mutationError,
    renameError,
    withFieldLabels,
};
