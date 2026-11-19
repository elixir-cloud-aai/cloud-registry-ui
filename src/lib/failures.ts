/**
 * @description the registry's failed operations (`GET /failures`, since the
 * cloud-registry release after 1.0.0rc2): failed imports, registrations,
 * updates and syncs, which admins and owners can't read in the registry's
 * logs. Reasons and operations are shown as fixed texts, never as text from
 * the registry, which has no raw errors in them either.
 */
import type {
    FailedOperation,
    Failure,
    FailureReason,
} from "./cloud-registry.types";
import { errorMessage } from "./errors";
import { hasStatus, isForbidden, isUnauthorized } from "./permissions";

/** The app's view of the failed operations */
const failuresPath = "/dashboard/failed-operations";

/** As the registry's `serviceId` filter allows */
const maxServiceIdLength = 1024;

const operationLabels: Record<FailedOperation, string> = {
    import: "Import",
    register: "Registration",
    update: "Update",
    sync: "Sync",
};

const failedOperations = Object.keys(operationLabels) as FailedOperation[];

// in plain words, for those who can't read the registry's logs; see "Failed
// operations" in the registry's API docs
const reasonTexts: Record<FailureReason, string> = {
    unreachable:
        "The registry couldn't fetch the service info: the service didn't answer in time, or its answer was unusable (e.g., a redirect, another status than 200, or too large).",
    "address not allowed":
        "The service's host resolves to an address that the registry may not fetch from, e.g. one of a private network.",
    "fetch failed":
        "The registry couldn't fetch the service info. Check that the address is right and that the service info is public; only the registry's admins see why it failed.",
    "not JSON": "The service info isn't JSON.",
    "invalid service info":
        "The service info doesn't pass the checks of a registration.",
    "identity mismatch":
        "The service info describes another service than the one registered.",
    "version awaiting approval":
        "The service info has a new service type version, which awaits the approval of an admin.",
    "version not allowed":
        "The service info has a service type version that isn't registered, and only admins may add it.",
    "unused types limit reached":
        "The service has a new service type, and its registrant has added as many unused service types as allowed.",
    "invalid field":
        "Some values aren't allowed by this registry, e.g. a URL, scheme, environment or service type.",
    "duplicate service":
        "A service with the same URL and API type is registered already.",
    "services limit reached":
        "The user has registered as many services as this registry allows.",
    "pending service":
        "The service awaits approval: only admins can change it, except to an approved service type.",
    "url locked by sync":
        "The service syncs with its service info, so its URL can't be changed.",
};

const failureReasons = Object.keys(reasonTexts) as FailureReason[];

// the reasons' names, as the registry has them, with capitals
const reasonLabels: Record<FailureReason, string> = {
    unreachable: "Unreachable",
    "address not allowed": "Address not allowed",
    "fetch failed": "Fetch failed",
    "not JSON": "Not JSON",
    "invalid service info": "Invalid service info",
    "identity mismatch": "Identity mismatch",
    "version awaiting approval": "Version awaiting approval",
    "version not allowed": "Version not allowed",
    "unused types limit reached": "Unused types limit reached",
    "invalid field": "Invalid field",
    "duplicate service": "Duplicate service",
    "services limit reached": "Services limit reached",
    "pending service": "Pending service",
    "url locked by sync": "URL locked by sync",
};

/**
 * Name an operation
 * @param operation The registry's operation
 * @returns E.g. "Import"; a fixed text for operations that the app doesn't
 * know
 */
function operationLabel(operation: string) {
    return Object.hasOwn(operationLabels, operation)
        ? operationLabels[operation as FailedOperation]
        : "Other operation";
}

/**
 * Name the reason of a failure
 * @param reason The registry's reason
 * @returns E.g. "Fetch failed"; a fixed text for reasons that the app doesn't
 * know
 */
function failureReasonLabel(reason: string) {
    return Object.hasOwn(reasonLabels, reason)
        ? reasonLabels[reason as FailureReason]
        : "Other reason";
}

/**
 * Explain why an operation failed
 * @param reason The registry's reason
 * @returns A fixed text, also for reasons that the app doesn't know
 */
function failureReasonText(reason: string) {
    return Object.hasOwn(reasonTexts, reason)
        ? reasonTexts[reason as FailureReason]
        : "The operation failed for a reason that this version of the app doesn't know.";
}

/** Filters of the list, as the registry has them */
interface FailuresFilter {
    operation?: FailedOperation;
    reason?: FailureReason;
    serviceId?: string;
}

/** A page of the list */
interface FailuresPageOptions {
    pageSize?: number;
    pageToken?: string;
}

/**
 * Read the filters from the address of the view, e.g. from a service's page
 * @param params Its query parameters
 * @returns The filters; values that the registry would refuse are dropped
 */
function readFailuresFilter(params: URLSearchParams): FailuresFilter {
    const filter: FailuresFilter = {};
    const operation = params.get("operation");
    if (operation && Object.hasOwn(operationLabels, operation))
        filter.operation = operation as FailedOperation;
    const reason = params.get("reason");
    if (reason && Object.hasOwn(reasonTexts, reason))
        filter.reason = reason as FailureReason;
    const serviceId = params.get("serviceId");
    if (serviceId && serviceId.length <= maxServiceIdLength)
        filter.serviceId = serviceId;
    return filter;
}

/**
 * Get the query of a request or link
 * @param filter The filters
 * @param page The page, if any
 * @returns The query, with `?`; empty without parameters
 */
function failuresQuery(
    filter: FailuresFilter,
    { pageSize, pageToken }: FailuresPageOptions = {},
) {
    const params = new URLSearchParams();
    if (filter.operation) params.set("operation", filter.operation);
    if (filter.reason) params.set("reason", filter.reason);
    if (filter.serviceId) params.set("serviceId", filter.serviceId);
    if (pageSize !== undefined) params.set("pageSize", String(pageSize));
    if (pageToken) params.set("pageToken", pageToken);
    const query = params.toString();
    return query ? `?${query}` : "";
}

/**
 * Get the link to the view
 * @param filter The filters, e.g. a service's identifier
 * @returns The app's path
 */
function failuresHref(filter: FailuresFilter = {}) {
    return `${failuresPath}${failuresQuery(filter)}`;
}

/**
 * Add the next page to the list
 * @param list The list so far
 * @param next The next page's failures
 * @returns The list with those of the next page that it hasn't yet
 */
function appendFailures(list: Failure[], next: Failure[]) {
    const ids = new Set(list.map((val) => val.id));
    return [...list, ...next.filter((val) => !ids.has(val.id))];
}

/**
 * Get what to show for a list that couldn't be read
 * @param err Error of the request
 * @returns The kind: `login` for an expired login, `unsupported` for
 * registries without the list (404), `forbidden` for a policy without its
 * rule (403), else `error`; and the message
 */
function failuresError(err: unknown) {
    if (isUnauthorized(err))
        return {
            kind: "login" as const,
            message: "Your session expired. Please log in again.",
        };
    if (hasStatus(err, 404))
        return {
            kind: "unsupported" as const,
            message:
                "This registry doesn't list failed operations: it is older than the app. Ask its admins to upgrade it.",
        };
    if (isForbidden(err))
        return {
            kind: "forbidden" as const,
            message:
                "The registry refuses to list failed operations. Its access policy may lack the rule for them: ask its admins.",
        };
    return {
        kind: "error" as const,
        message: hasStatus(err, 400)
            ? errorMessage(
                  err,
                  "Could not load the failed operations. Please try again.",
              )
            : "Could not load the failed operations. Please try again.",
    };
}

export type { FailuresFilter, FailuresPageOptions };
export {
    appendFailures,
    failedOperations,
    failureReasonLabel,
    failureReasons,
    failureReasonText,
    failuresError,
    failuresHref,
    failuresPath,
    failuresQuery,
    operationLabel,
    readFailuresFilter,
};
