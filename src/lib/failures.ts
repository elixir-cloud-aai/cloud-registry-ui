/**
 * @description the registry's failed operations (`GET /failures`,
 * cloud-registry#418, in the first release after 1.0.0rc2): failed imports,
 * registrations, updates and syncs, which admins and owners can't read in the
 * registry's logs. Reasons and operations are shown as fixed texts, never as
 * text from the registry, which has no raw errors in them either.
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

/** Longest service identifier that the registry's `serviceId` filter takes */
const maxServiceIdLength = 1024;

const operationLabels: Record<FailedOperation, string> = {
    import: "Import",
    register: "Registration",
    update: "Update",
    sync: "Sync",
};

const failedOperations = Object.keys(operationLabels) as FailedOperation[];

/**
 * Each reason's name (the registry's, with capitals) and its explanation, in
 * plain words, for those who can't read the registry's logs (see "Failed
 * operations" in the registry's API docs). The reasons of syncs also have
 * texts in `service-sync.ts`, which complete a sentence about the state of a
 * sync ("Out of sync: ..."); these stand alone, and also cover the fetches of
 * imports
 */
const reasons: Record<FailureReason, { label: string; text: string }> = {
    unreachable: {
        label: "Unreachable",
        text: "The registry couldn't fetch the service info: the service didn't answer in time, or its answer was unusable (e.g., a redirect, another status than 200, or too large).",
    },
    "address not allowed": {
        label: "Address not allowed",
        text: "The service's host resolves to an address that the registry may not fetch from, e.g. one of a private network.",
    },
    "fetch failed": {
        label: "Fetch failed",
        text: "The registry couldn't fetch the service info. Check that the address is right and that the service info is public; only the registry's admins see why it failed.",
    },
    "not JSON": {
        label: "Not JSON",
        text: "The service info isn't JSON.",
    },
    "invalid service info": {
        label: "Invalid service info",
        text: "The service info doesn't pass the checks of a registration.",
    },
    "identity mismatch": {
        label: "Identity mismatch",
        text: "The service info describes another service than the one registered.",
    },
    "version awaiting approval": {
        label: "Version awaiting approval",
        text: "The service info has a new service type version, which awaits the approval of an admin.",
    },
    "version not allowed": {
        label: "Version not allowed",
        text: "The service info has a service type version that isn't registered, and only admins may add it.",
    },
    "unused types limit reached": {
        label: "Unused types limit reached",
        text: "The service has a new service type, and its registrant has added as many unused service types as allowed.",
    },
    "invalid field": {
        label: "Invalid field",
        text: "Some values aren't allowed by this registry, e.g. a URL, scheme, environment or service type.",
    },
    "duplicate service": {
        label: "Duplicate service",
        text: "A service with the same URL and API type is registered already.",
    },
    "services limit reached": {
        label: "Services limit reached",
        text: "The user has registered as many services as this registry allows.",
    },
    "pending service": {
        label: "Pending service",
        text: "The service awaits approval: only admins can change it, except to an approved service type.",
    },
    "url locked by sync": {
        label: "URL locked by sync",
        text: "The service syncs with its service info, so its URL can't be changed.",
    },
};

const failureReasons = Object.keys(reasons) as FailureReason[];

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
    return Object.hasOwn(reasons, reason)
        ? reasons[reason as FailureReason].label
        : "Other reason";
}

/**
 * Explain why an operation failed
 * @param reason The registry's reason
 * @returns A fixed text, also for reasons that the app doesn't know
 */
function failureReasonText(reason: string) {
    return Object.hasOwn(reasons, reason)
        ? reasons[reason as FailureReason].text
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
    if (reason && Object.hasOwn(reasons, reason))
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
 * Say who acted
 * @param failure The failure
 * @param admin Whether the user is an admin in admin mode
 * @returns The user's identifier, if served; else, for admins in admin mode,
 * who see it on all but the registry's syncs, "Registry"; for others, who
 * see it only on their own failures, "Not shown"
 */
function failureActor(failure: Failure, admin: boolean) {
    if (failure.userId !== undefined) return failure.userId;
    return admin ? "Registry" : "Not shown";
}

/** What to show for a list that couldn't be read */
interface FailuresError {
    /** `login`: expired login; `unsupported`: a registry without the list;
     * `forbidden`: a policy without its rule; `error`: anything else */
    kind: "login" | "unsupported" | "forbidden" | "error";
    message: string;
}

const loadFailed = "Could not load the failed operations. Please try again.";

/**
 * Get what to show for a list that couldn't be read
 * @param err Error of the request
 * @returns The kind and the message: the registry's detail only for invalid
 * requests (400, e.g. an expired page token), which name what the app sent;
 * other failures have a fixed text
 */
function failuresError(err: unknown): FailuresError {
    if (isUnauthorized(err))
        return {
            kind: "login",
            message: "Your session expired. Please log in again.",
        };
    if (hasStatus(err, 404))
        return {
            kind: "unsupported",
            message:
                "This registry doesn't list failed operations: it is older than the app. Ask its admins to upgrade it.",
        };
    if (isForbidden(err))
        return {
            kind: "forbidden",
            message:
                "The registry refuses to list failed operations. Its access policy may lack the rule for them: ask its admins.",
        };
    return {
        kind: "error",
        message: hasStatus(err, 400)
            ? errorMessage(err, loadFailed)
            : loadFailed,
    };
}

export type { FailuresError, FailuresFilter, FailuresPageOptions };
export {
    appendFailures,
    failedOperations,
    failureActor,
    failureReasonLabel,
    failureReasons,
    failureReasonText,
    failuresError,
    failuresHref,
    failuresPath,
    failuresQuery,
    maxServiceIdLength,
    operationLabel,
    readFailuresFilter,
};
