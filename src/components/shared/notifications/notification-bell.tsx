"use client";
import { getCookie } from "cookies-next/client";
import { BellIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useCloudRegistry, useLatestRequest } from "@/hooks";
import { isAborted } from "@/lib/abort";
import type { AppNotification } from "@/lib/cloud-registry.types";
import {
    notificationCount,
    notificationView,
    restoreNotification,
    timeAgo,
} from "@/lib/notifications";
import { hasStatus, isUnauthorized } from "@/lib/permissions";
import { sessionCookie } from "@/lib/session-cookies";

// how often to read the notifications while the page is visible
const refreshInterval = 60_000;

/** One notification in the list of the bell */
function NotificationItem({
    notification,
    serviceName,
    onDismiss,
    onFollow,
}: {
    notification: AppNotification;
    serviceName?: string;
    onDismiss: () => void;
    onFollow: () => void;
}) {
    const view = notificationView(notification, serviceName);
    const time = timeAgo(notification.since);
    return (
        <li className="flex items-start gap-2 border-b px-4 py-3 last:border-b-0">
            <span
                aria-hidden="true"
                className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive"
            />
            <div className="min-w-0 flex-1 wrap-anywhere">
                <p className="text-sm font-medium">{view.title}</p>
                <p className="text-sm text-muted-foreground">{view.text}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    {time && <time dateTime={notification.since}>{time}</time>}
                    {view.href && (
                        <Link
                            href={view.href}
                            onClick={onFollow}
                            className="text-primary underline underline-offset-2"
                        >
                            {view.action}
                        </Link>
                    )}
                </div>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                aria-label={`Dismiss: ${view.title}`}
                onClick={onDismiss}
            >
                <XIcon className="size-3.5" />
            </Button>
        </li>
    );
}

/** The bell in the top bar, for logged-in users: what needs their attention,
 * with a red number if anything does. Registries without notifications (older
 * than cloud-registry 1.0.0rc2) show no bell */
function NotificationBell() {
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const [notifications, setNotifications] = useState<AppNotification[]>();
    const [names, setNames] = useState<Map<string, string>>(new Map());
    const [open, setOpen] = useState(false);
    // the read under way, also aborted on unmount
    const latest = useLatestRequest();
    // whether reading has ever worked, and whether to give up on it
    const loaded = useRef(false);
    const stopped = useRef(false);
    // being dismissed, so that a read from before can't bring them back
    const dismissing = useRef(new Set<string>());
    // at most one read at a time, also if the registry stalls
    const reading = useRef(false);
    // the login that the list belongs to, and the list's generation, so that
    // nothing that was under way brings back the list of another login
    const token = useRef<string>(undefined);
    const session = useRef(0);

    // for another login: another user may use this browser
    const clear = useCallback(() => {
        latest.abort();
        session.current++;
        reading.current = false;
        setNotifications(undefined);
        setNames(new Map());
        setOpen(false);
    }, [latest]);

    const read = useCallback(() => {
        if (!cloudRegistryProvider) return;
        // e.g. logged out or in as another user in another tab, which nothing
        // here gets to know of
        const current = sessionCookie("access_token", getCookie);
        if (!isLoggedIn || !current || current !== token.current) {
            clear();
            return;
        }
        if (stopped.current || reading.current) return;
        reading.current = true;
        const signal = latest.next();
        cloudRegistryProvider
            .getNotifications({ signal })
            .then((val) => {
                if (signal.aborted) return;
                loaded.current = true;
                setNotifications(
                    val?.filter((item) => !dismissing.current.has(item.id)),
                );
            })
            .catch((err) => {
                if (signal.aborted || isAborted(err)) return;
                if (isUnauthorized(err)) {
                    stopped.current = true;
                    clear();
                } else if (hasStatus(err, 404) && !loaded.current) {
                    // a registry without notifications
                    stopped.current = true;
                } else console.error("Failed to load notifications:", err);
            })
            .finally(() => {
                if (!signal.aborted) reading.current = false;
            });
    }, [clear, cloudRegistryProvider, isLoggedIn, latest]);

    useEffect(() => {
        stopped.current = false;
        reading.current = false;
        const now = sessionCookie("access_token", getCookie);
        // names depend on who reads them
        if (now !== token.current) setNames(new Map());
        token.current = now;
        read();
        const refresh = () => {
            if (document.visibilityState === "visible") read();
        };
        const timer = setInterval(refresh, refreshInterval);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            session.current++;
            clearInterval(timer);
            document.removeEventListener("visibilitychange", refresh);
            latest.abort();
        };
    }, [read, latest]);

    // the names of the services, once the list is opened, with the user's
    // token, as pending ones aren't listed publicly; those without a name keep
    // their identifier, so that they aren't asked for again
    const count = notifications?.length ?? 0;
    const namesMissing = !!notifications?.some(
        (val) => val.serviceId && !names.has(val.serviceId),
    );
    useEffect(() => {
        if (!open || !namesMissing || !cloudRegistryProvider) return;
        const controller = new AbortController();
        const { signal } = controller;
        const lookup = session.current;
        cloudRegistryProvider
            .getServicesAsUser({ signal })
            .then((services) => {
                if (signal.aborted || lookup !== session.current) return;
                const known = new Map(
                    services.map((val) => [val.id, val.name]),
                );
                for (const { serviceId } of notifications ?? [])
                    if (serviceId && !known.has(serviceId))
                        known.set(serviceId, serviceId);
                setNames(known);
            })
            .catch((err) => {
                if (!isAborted(err))
                    console.error("Failed to load the services' names:", err);
            });
        return () => controller.abort();
    }, [open, namesMissing, notifications, cloudRegistryProvider]);

    const dismiss = async (id: string) => {
        const index = notifications?.findIndex((item) => item.id === id) ?? -1;
        const notification = notifications?.[index];
        if (
            !cloudRegistryProvider ||
            !notification ||
            dismissing.current.has(id)
        )
            return;
        const started = session.current;
        let failed = false;
        dismissing.current.add(id);
        setNotifications((val) => val?.filter((item) => item.id !== id));
        try {
            await cloudRegistryProvider.dismissNotification(id);
        } catch (err) {
            // gone already, which is what users asked for
            if (hasStatus(err, 404)) return;
            if (isUnauthorized(err)) {
                stopped.current = true;
                clear();
                return;
            }
            failed = true;
            if (started === session.current)
                setNotifications(
                    (val) =>
                        val && restoreNotification(val, notification, index),
                );
            toast.error(
                "Could not dismiss this notification. Please try again.",
            );
        } finally {
            dismissing.current.delete(id);
            // what a read from before the end of this request says is outdated;
            // the next one comes with the interval
            latest.abort();
            reading.current = false;
            // it may have worked, if only the answer got lost
            if (failed && started === session.current) read();
        }
    };

    if (!notifications) return null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={
                        count ? `Notifications (${count})` : "Notifications"
                    }
                >
                    <BellIcon className="h-4 w-4" />
                    {count > 0 && (
                        <span
                            data-testid="notification-count"
                            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white"
                        >
                            {notificationCount(count)}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                className="w-96 max-w-[calc(100vw-2rem)] p-0"
            >
                <h2 className="border-b px-4 py-3 text-sm font-semibold">
                    Notifications
                </h2>
                {count ? (
                    <ul className="max-h-[60vh] overflow-y-auto">
                        {notifications.map((val) => (
                            <NotificationItem
                                key={val.id}
                                notification={val}
                                serviceName={
                                    val.serviceId
                                        ? names.get(val.serviceId)
                                        : undefined
                                }
                                onDismiss={() => dismiss(val.id)}
                                onFollow={() => setOpen(false)}
                            />
                        ))}
                    </ul>
                ) : (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                        Nothing needs your attention.
                    </p>
                )}
            </PopoverContent>
        </Popover>
    );
}

export { NotificationBell };
