/**
 * @description syncs of services with their service info
 * (`PUT /services/{serviceId}/sync`): how often the registry syncs, and what
 * to tell users about a sync. The registry's reasons are shown as fixed texts,
 * as it has no raw errors in them, and neither should the app.
 */
import type {
    ExternalService,
    ServiceSync,
    ServiceSyncState,
    SyncReason,
} from "./cloud-registry.types";
import {
    errorMessage,
    isServiceBusy,
    isSyncIdentityMismatch,
    isSyncUnavailable,
    mutationError,
    retryAfterText,
} from "./errors";
import { hasStatus } from "./permissions";
import { matchesVerification } from "./verifications";

const hoursPerDay = 24;

/**
 * Describe how often the registry syncs
 * @param hours Time between syncs, in hours (`intervalHours`)
 * @returns E.g. "every hour", "every 6 hours", "every day", "every 2 days";
 * whole days as days, anything else as hours
 */
function syncFrequency(hours: number) {
    if (hours % hoursPerDay === 0) {
        const days = hours / hoursPerDay;
        return days === 1 ? "every day" : `every ${days} days`;
    }
    return hours === 1 ? "every hour" : `every ${hours} hours`;
}

const syncReasons: Record<SyncReason, string> = {
    unreachable:
        "the service info can't be fetched: the service may be down, or its service info may not be public.",
    "address not allowed":
        "the service's host resolves to an address that the registry may not fetch from.",
    "invalid service info":
        "the service info doesn't pass the checks of a registration.",
    "identity mismatch":
        "the service info now describes another service than the one registered.",
    "version awaiting approval":
        "the service info has a new service type version, which awaits the approval of an admin. The next sync after the approval applies it.",
    "version not allowed":
        "the service info has a service type version that isn't registered, and only admins may add it. Ask them to.",
    "unused types limit reached":
        "the service info has a new service type version, and the registrant of this service has added as many unused service types as allowed.",
};

/**
 * Get the text for why a service is out of sync
 * @param reason The registry's reason, if any
 * @returns A fixed text, also for reasons that the app doesn't know; without a
 * reason, nothing failed, but no sync succeeded in time: syncs aren't running
 */
function syncReasonText(reason: string | undefined) {
    if (reason === undefined)
        return "the registry hasn't synced this service in time: syncs may not be running, so please tell the registry's operators.";
    return Object.hasOwn(syncReasons, reason)
        ? syncReasons[reason as SyncReason]
        : "the service info can't be applied.";
}

/**
 * Get the message for a sync that was turned on
 * @param sync The state of the sync, which the registry returned
 * @returns The kind of message, and the message: sync is also on if the values
 * can't be applied (`reason`)
 */
function syncStartedMessage({ status, reason }: ServiceSync) {
    return status === "synced" && reason === undefined
        ? {
              kind: "success" as const,
              message: "Sync is on: the service follows its service info.",
          }
        : {
              kind: "warning" as const,
              message: `Sync is on, but the service is out of sync: ${syncReasonText(reason)}`,
          };
}

/**
 * Get the reason for a sync that couldn't be turned on, or a sync that failed;
 * the registry changes nothing in these cases
 * @param err Error of the request
 * @returns The reason, for all problems of fetching the same one, as the
 * registry doesn't tell them apart
 */
function syncFailedReason(err: unknown) {
    if (hasStatus(err, 502))
        return "The registry could not fetch the service info. It must be publicly available at the service's URL followed by /service-info.";
    if (hasStatus(err, 429))
        return `Service info was fetched too often, or the registry is busy. ${retryAfterText(err)}`;
    if (hasStatus(err, 400))
        return errorMessage(
            err,
            "The service info doesn't pass the checks of a registration.",
        );
    if (isSyncUnavailable(err))
        return "This registry doesn't sync this service.";
    if (isSyncIdentityMismatch(err))
        return "The service info describes another type of service than the one registered.";
    if (isServiceBusy(err))
        return "The service changed during the sync. Please try again.";
    return mutationError(err, "Cannot sync this service currently.");
}

/**
 * Say how a sync of a new service failed
 * @param err Error of the request
 * @returns That sync is off if the registry answered; without an answer, it
 * may have turned it on
 */
function syncFailedTitle(err: unknown) {
    return typeof (err as { status?: unknown } | undefined)?.status === "number"
        ? "The service is registered, but sync is off."
        : "The service is registered, but the app can't tell if sync is on.";
}

/**
 * Get the states of the services' syncs, for their labels
 * @param services Services as registered
 * @param syncs States from `GET /syncs`
 * @returns The states by service identifier, only those of the same URL and
 * API type as the service, so that a service changed between the two requests
 * has no label
 */
function syncedServices(
    services: ExternalService[],
    syncs: ServiceSyncState[],
) {
    const servicesById = new Map(services.map((val) => [val.id, val]));
    return new Map(
        syncs
            .filter((val) => {
                const service = servicesById.get(val.serviceId);
                return !!service && matchesVerification(service, val);
            })
            .map((val) => [val.serviceId, val]),
    );
}

/**
 * Format the time of a sync
 * @param time RFC 3339 date-time, if any
 * @returns The time for the user's locale, or "Never"
 */
function formatSyncTime(time?: string) {
    return time ? new Date(time).toLocaleString() : "Never";
}

export {
    formatSyncTime,
    syncedServices,
    syncFailedReason,
    syncFailedTitle,
    syncFrequency,
    syncReasonText,
    syncStartedMessage,
};
