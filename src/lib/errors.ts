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

/** Get the registry's detail for a failed request, else the fallback */
function errorMessage(err: unknown, fallback: string) {
    if (
        err instanceof Error &&
        "detail" in err &&
        typeof err.detail === "string"
    )
        return withFieldLabels(err.detail);
    return fallback;
}

/** Get the message for a failed change: login, role, detail or fallback */
function mutationError(err: unknown, fallback: string) {
    if (isUnauthorized(err))
        return "Your session expired. Please log in again.";
    if (isForbidden(err))
        return "You don't have permission to change this service.";
    return errorMessage(err, fallback);
}

export { errorMessage, mutationError, withFieldLabels };
