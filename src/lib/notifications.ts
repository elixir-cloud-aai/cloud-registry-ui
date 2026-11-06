/**
 * @description what the registry's notifications (`GET /notifications`) say in
 * the app: fixed texts by type and reason, never text from the registry, and a
 * link to the view that fixes them. The identifiers are opaque: an item may
 * come back under the same one.
 */
import type { AppNotification } from "./cloud-registry.types";
import { syncReasonText } from "./service-sync";
import { typeLabel } from "./service-types";

/** The registry's reason if no sync succeeded in time: nothing failed */
const noRecentSync = "no recent sync";

/** What a notification says, and where to go about it */
type NotificationView = {
    title: string;
    text: string;
    /** The view that fixes it, if any */
    href?: string;
    /** What the link does */
    action?: string;
};

function servicePath(serviceId: string, view: "view" | "update" = "view") {
    return `/dashboard/services/${view}/${encodeURIComponent(serviceId)}`;
}

/**
 * Get what a notification says
 * @param notification The registry's notification
 * @param serviceName Name of the service, if known; else its identifier
 * @returns The texts and the link; a notification of a type that the app
 * doesn't know says only that something needs attention
 */
function notificationView(
    notification: AppNotification,
    serviceName?: string,
): NotificationView {
    const { type, serviceId, serviceType, reason } = notification;
    const service = serviceName ?? serviceId ?? "A service";
    const page = serviceId ? servicePath(serviceId) : undefined;
    const edit = serviceId ? servicePath(serviceId, "update") : undefined;
    switch (type) {
        case "out-of-sync": {
            const text =
                reason === noRecentSync
                    ? syncReasonText(undefined)
                    : syncReasonText(reason);
            return {
                title: `${service} is out of sync`,
                text: text.charAt(0).toUpperCase() + text.slice(1),
                href: page,
                action: "View service",
            };
        }
        case "pending-service-type":
            return {
                title: serviceType
                    ? `Service type ${typeLabel(serviceType)} awaits approval`
                    : "A service type awaits approval",
                text: "Approve or remove it on the page of service types.",
                href: "/dashboard/service-types",
                action: "View service types",
            };
        case "pending-service":
            return {
                title: `${service} awaits approval`,
                text: "It has a service type that awaits approval.",
                href: page,
                action: "View service",
            };
        case "environment-not-allowed":
            return {
                title: `${service} has an environment that isn't allowed`,
                text: "The registry no longer allows it. Change it, or the service can't be updated.",
                href: edit,
                action: "Edit service",
            };
        case "url-scheme-not-allowed":
            return {
                title: `${service} has a URL scheme that isn't allowed`,
                text: "The registry no longer allows it. Change the URL, or the service can't be updated.",
                href: edit,
                action: "Edit service",
            };
        default:
            return {
                title: serviceId
                    ? `${service} needs attention`
                    : "Something needs attention",
                text: "Please check this entry in the registry.",
                href: page,
                action: page && "View service",
            };
    }
}

/**
 * Put a notification back after a failed dismissal, leaving the others as they
 * are by now
 * @param notifications The list by now
 * @param notification The notification
 * @param index Where it was
 * @returns The list with it, unless a newer read brought it back already
 */
function restoreNotification(
    notifications: AppNotification[],
    notification: AppNotification,
    index: number,
) {
    if (notifications.some((val) => val.id === notification.id))
        return notifications;
    return [
        ...notifications.slice(0, index),
        notification,
        ...notifications.slice(index),
    ];
}

/**
 * Get the text of the number on the bell
 * @param count Number of notifications
 * @returns The number, at most "99+"
 */
function notificationCount(count: number) {
    return count > 99 ? "99+" : String(count);
}

const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
];

/**
 * Describe when something happened
 * @param since RFC 3339 date-time, if known
 * @param now The current time, in milliseconds
 * @returns E.g. "3 hours ago"; undefined if unknown or not a date
 */
function timeAgo(since: string | undefined, now = Date.now()) {
    if (!since) return undefined;
    const time = Date.parse(since);
    if (Number.isNaN(time)) return undefined;
    const seconds = Math.max(0, Math.round((now - time) / 1000));
    const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    for (const [unit, size] of units)
        if (seconds >= size)
            return format.format(-Math.floor(seconds / size), unit);
    return "just now";
}

export {
    noRecentSync,
    notificationCount,
    notificationView,
    restoreNotification,
    timeAgo,
};
