"use client";
import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRegistrationRules } from "@/hooks";
import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import type { ServiceSync } from "@/lib/cloud-registry.types";
import { mutationError } from "@/lib/errors";
import { hasStatus } from "@/lib/permissions";
import {
    formatSyncTime,
    syncFailedReason,
    syncFrequency,
    syncReasonText,
    syncStartedMessage,
} from "@/lib/service-sync";
import { Field, SectionCard } from "./service-dailog-card-misc";

type Props = {
    serviceId: string;
    /** The state of the sync; undefined without one */
    sync?: ServiceSync;
    /** False while the state loads */
    loaded: boolean;
    /** The state couldn't be read, so it is unknown */
    failed: boolean;
    /** Whether the user may turn sync on or off, and sync now */
    canManage: boolean;
    provider: AuthenticatedCloudRegistryProvider | null;
    /** Take the state that the registry returned; the service's values may
     * have changed, too */
    onSyncChange: (sync?: ServiceSync) => void;
    /** Read the state and the service again: a request failed, and may have
     * worked in the registry if only its answer got lost */
    onRefresh: () => void;
};

/** The sync of a service with its service info, in its details: its state, why
 * it is out of sync, and the controls for those who may use them. Also explains
 * the labels, which say nothing about trust */
function ServiceSyncSection({
    serviceId,
    sync,
    loaded,
    failed,
    canManage,
    provider,
    onSyncChange,
    onRefresh,
}: Props) {
    const { rules, loading } = useRegistrationRules();
    const [busy, setBusy] = useState(false);
    const [confirmOn, setConfirmOn] = useState(false);
    const rule = rules.serviceInfoSync;

    // a sync shows also if the rules can't be read
    if (loading || (!rule?.enabled && !sync)) return null;
    const frequency = rule ? syncFrequency(rule.intervalHours) : "regularly";

    const handleSync = async () => {
        if (!provider) return;
        setBusy(true);
        try {
            const state = await provider.syncService(serviceId);
            onSyncChange(state);
            const { kind, message } = syncStartedMessage(state);
            toast[kind](message);
        } catch (err) {
            toast.error(syncFailedReason(err));
            // the service is gone, or sync was turned off during the fetch
            if (hasStatus(err, 404)) onSyncChange(undefined);
            else onRefresh();
        } finally {
            setBusy(false);
        }
    };

    // only if sync is on: turning it on needs a confirmation, and someone may
    // have turned it off since this page loaded
    const handleSyncNow = async () => {
        if (!provider) return;
        setBusy(true);
        try {
            const state = await provider.syncService(serviceId, {
                onlyIfEnabled: true,
            });
            onSyncChange(state);
            const { kind, message } = syncStartedMessage(state);
            toast[kind](message);
        } catch (err) {
            if (hasStatus(err, 404)) {
                onSyncChange(undefined);
                toast.info(
                    "Sync was turned off in the meantime, so nothing was synced.",
                );
            } else {
                toast.error(syncFailedReason(err));
                onRefresh();
            }
        } finally {
            setBusy(false);
        }
    };

    const handleTurnOff = async () => {
        if (!provider) return;
        setBusy(true);
        try {
            await provider.removeServiceSync(serviceId);
            onSyncChange(undefined);
            toast.success("Sync is off: the service keeps its values.");
        } catch (err) {
            if (hasStatus(err, 404)) onSyncChange(undefined);
            else {
                toast.error(
                    mutationError(err, "Cannot turn off sync currently."),
                );
                onRefresh();
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="px-6 pt-5">
            <SectionCard
                icon={
                    <RefreshCwIcon className="size-3.5 text-muted-foreground" />
                }
                title="Sync with service info"
            >
                <div className="flex flex-col gap-3">
                    {failed && (
                        <p className="text-sm text-muted-foreground">
                            Could not load the sync of this service, so this
                            page can't say whether it is synced.
                        </p>
                    )}
                    {!sync && loaded && !failed && (
                        <p className="text-sm text-muted-foreground">
                            This service isn't synced, so its entry may have
                            drifted from what the service says about itself.
                        </p>
                    )}
                    {sync && (
                        <>
                            <p className="text-sm text-muted-foreground">
                                The registry updates this entry from the
                                service's public service info {frequency}.
                                Manual changes last until the next sync, and the
                                service URL can't change while sync is on.
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                <Field
                                    label="Last Success"
                                    value={formatSyncTime(sync.lastSuccessAt)}
                                />
                                <Field
                                    label="Last Attempt"
                                    value={formatSyncTime(sync.lastAttemptAt)}
                                />
                            </div>
                            {sync.status === "out-of-sync" && (
                                <p
                                    role="status"
                                    className="text-sm text-amber-800 dark:text-amber-200"
                                >
                                    Out of sync: {syncReasonText(sync.reason)}
                                </p>
                            )}
                        </>
                    )}
                    <p className="text-sm text-muted-foreground">
                        <strong className="font-medium">Verified</strong> says
                        that an admin checked this entry once, and{" "}
                        <strong className="font-medium">synced</strong> that the
                        service recently described itself in a way the registry
                        could read. Verified and synced doesn't mean trusted: a
                        service can change at any time, so decide yourself whom
                        you trust.
                    </p>
                    {canManage && loaded && !failed && (
                        <div className="flex flex-wrap gap-2">
                            {sync ? (
                                <>
                                    <Button
                                        size="sm"
                                        variant={"outline"}
                                        disabled={busy}
                                        onClick={handleSyncNow}
                                    >
                                        Sync now
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant={"outline"}
                                        disabled={busy}
                                        onClick={handleTurnOff}
                                    >
                                        Turn sync off
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    size="sm"
                                    variant={"outline"}
                                    disabled={busy}
                                    onClick={() => setConfirmOn(true)}
                                >
                                    Turn sync on
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </SectionCard>
            <AlertDialog open={confirmOn} onOpenChange={setConfirmOn}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Turn sync on?</AlertDialogTitle>
                        <AlertDialogDescription>
                            The registry replaces the values of this service
                            with those of its service info now and {frequency},
                            which overrides manual changes. Its service info
                            must be publicly available at the service's URL
                            followed by /service-info, as no tokens are sent.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSync}>
                            Turn sync on
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default ServiceSyncSection;
