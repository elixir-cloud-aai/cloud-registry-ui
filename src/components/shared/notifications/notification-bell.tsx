"use client";
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
import { useCloudRegistry } from "@/hooks";
import type { AppNotification } from "@/lib/cloud-registry.types";
import {
    notificationCount,
    notificationView,
    timeAgo,
} from "@/lib/notifications";
import { hasStatus, isUnauthorized } from "@/lib/permissions";

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
    const latest = useRef(0);

    const read = useCallback(() => {
        if (!cloudRegistryProvider || !isLoggedIn) return;
        const request = ++latest.current;
        cloudRegistryProvider
            .getNotifications()
            .then((val) => {
                if (request === latest.current) setNotifications(val);
            })
            .catch((err) => {
                if (request !== latest.current) return;
                // keep what is shown, unless the session ended; older
                // registries can't answer at all
                if (isUnauthorized(err) || hasStatus(err, 404))
                    setNotifications(undefined);
                else console.error("Failed to load notifications:", err);
            });
    }, [cloudRegistryProvider, isLoggedIn]);

    useEffect(() => {
        read();
        const refresh = () => {
            if (document.visibilityState === "visible") read();
        };
        const timer = setInterval(refresh, refreshInterval);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", refresh);
            latest.current++;
        };
    }, [read]);

    // the names of the services, once the list is opened; pending ones aren't
    // listed publicly, and show their identifier
    const count = notifications?.length ?? 0;
    useEffect(() => {
        if (!open || !count || !cloudRegistryProvider) return;
        let current = true;
        cloudRegistryProvider
            .getServices()
            .then((services) => {
                if (current)
                    setNames(
                        new Map(services.map((val) => [val.id, val.name])),
                    );
            })
            .catch((err) => {
                console.error("Failed to load the services' names:", err);
            });
        return () => {
            current = false;
        };
    }, [open, count, cloudRegistryProvider]);

    const dismiss = async (id: string) => {
        if (!cloudRegistryProvider) return;
        latest.current++;
        const before = notifications;
        setNotifications((val) => val?.filter((item) => item.id !== id));
        try {
            await cloudRegistryProvider.dismissNotification(id);
        } catch (err) {
            // gone already, which is what users asked for
            if (hasStatus(err, 404)) return;
            setNotifications(before);
            toast.error(
                "Could not dismiss this notification. Please try again.",
            );
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
