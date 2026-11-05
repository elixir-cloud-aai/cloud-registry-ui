"use client";
import { ListPlus, ListX, RotateCw, Rows3 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCloudRegistry, useLatestRequest, useMe } from "@/hooks";
import { isAborted } from "@/lib/abort";
import type { SelfListing as Listing } from "@/lib/cloud-registry.types";
import { selfListingError } from "@/lib/errors";
import { canChangeSelfListing } from "@/lib/permissions";

/**
 * Whether the registry is listed among its own services, and a button to
 * change that, for admins in admin mode: the registry refuses the request
 * for the state to others. The pages of the services and service types load
 * them each time they open, so they show the change without more ado
 */
function SelfListing() {
    const { cloudRegistryProvider } = useCloudRegistry();
    const { me } = useMe();
    const allowed = canChangeSelfListing(me);
    // undefined while loading, null if it can't be loaded
    const [listing, setListing] = useState<Listing | null>();
    const [changing, setChanging] = useState(false);

    // also aborted on unmount
    const latestRequest = useLatestRequest();

    // whether the state could be read; aborted reads, by a newer one or on
    // unmount, have nothing to report
    const load = useCallback(async () => {
        if (!cloudRegistryProvider) return false;
        const signal = latestRequest.next();
        try {
            const listing = await cloudRegistryProvider.getSelfListing({
                signal,
            });
            if (!signal.aborted) setListing(listing);
            return true;
        } catch (err) {
            if (signal.aborted || isAborted(err)) return true;
            console.error("Failed to load the listing of the registry:", err);
            // what the page knows stays, e.g. if a change failed for the same
            // reason, which its toast tells
            setListing((val) => val ?? null);
            return false;
        }
    }, [cloudRegistryProvider, latestRequest]);

    useEffect(() => {
        if (allowed) load();
    }, [allowed, load]);

    const change = async (
        request: Promise<Listing>,
        messages: { loading: string; success: string; fallback: string },
    ) => {
        setChanging(true);
        toast.promise(request, {
            loading: messages.loading,
            success: messages.success,
            error: (err) => selfListingError(err, messages.fallback),
        });
        try {
            setListing(await request);
        } catch {
            // toast.promise shows the error; the state may be another one
            // than the page knew, e.g. after a 404
            await load();
        } finally {
            setChanging(false);
        }
    };

    const retry = async () => {
        setChanging(true);
        if (!(await load()))
            toast.error("Still can't check whether the registry is listed.");
        setChanging(false);
    };

    const add = () => {
        if (!cloudRegistryProvider) return;
        change(cloudRegistryProvider.addSelfListing(), {
            loading: "Adding the registry to its services",
            success: "The registry is listed among its services.",
            fallback: "Cannot add the registry currently.",
        });
    };

    const remove = () => {
        if (!cloudRegistryProvider) return;
        change(cloudRegistryProvider.removeSelfListing(), {
            loading: "Removing the registry from its services",
            success: "The registry is no longer listed among its services.",
            fallback: "Cannot remove the registry currently.",
        });
    };

    if (!allowed || listing === undefined) return null;

    return (
        <>
            <Separator className="md:col-span-2" />
            <section
                aria-labelledby="self-listing"
                className="space-y-3 md:col-span-2"
            >
                <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <Rows3 className="w-4 h-4" />
                    <h3 id="self-listing" className="font-medium">
                        Service Listing
                    </h3>
                </div>
                {listing === null && (
                    <div className="pl-6 space-y-2">
                        <p className="text-xs text-muted-foreground">
                            Could not check whether the registry is listed among
                            its services. If this persists, the registry may be
                            older than cloud-registry 1.0.0rc2, which this
                            needs.
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={changing}
                            onClick={retry}
                        >
                            <RotateCw />
                            Try again
                        </Button>
                    </div>
                )}
                {listing && !listing.listed && (
                    <div className="pl-6 space-y-2">
                        <p className="text-xs text-slate-600">
                            This registry isn&apos;t listed among its services.
                            Adding it lets clients find it like any other
                            service.
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={changing}
                            onClick={add}
                        >
                            <ListPlus />
                            Add to services
                        </Button>
                    </div>
                )}
                {listing?.listed && (
                    <div className="pl-6 space-y-2">
                        <p className="text-xs text-slate-600 wrap-anywhere">
                            This registry is listed among its services
                            {listing.serviceId && (
                                <>
                                    {" as "}
                                    <Link
                                        href={`/dashboard/services/view/${encodeURIComponent(listing.serviceId)}`}
                                        className="text-blue-600 hover:underline"
                                    >
                                        {listing.serviceId}
                                    </Link>
                                </>
                            )}
                            .
                        </p>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={changing}
                                >
                                    <ListX />
                                    Remove from services
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>
                                        Remove from Services?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                        The registry is then no longer listed
                                        among its services. Its service type
                                        goes too, unless other services have it,
                                        and so do roles on its entry. You can
                                        add it again.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>
                                        Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        disabled={changing}
                                        onClick={remove}
                                    >
                                        Remove
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                )}
            </section>
        </>
    );
}

export default SelfListing;
