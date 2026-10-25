import type { ExternalToast } from "sonner";
import { isForbidden, isUnauthorized } from "./permissions";

// labels of the create and edit forms, by field path
const fieldLabels: Record<string, string> = {
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

/** Get the message for a failed change: login, role, detail or fallback */
function mutationError(err: unknown, fallback: string) {
    if (isUnauthorized(err))
        return "Your session expired. Please log in again.";
    if (isForbidden(err))
        return "You don't have permission to change this service.";
    return errorMessage(err, fallback);
}

/** Check if a change failed as it duplicates a registered service */
function isDuplicate(err: unknown): err is Error {
    return err instanceof Error && "status" in err && err.status === 409;
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
    mutationError,
    withFieldLabels,
};
