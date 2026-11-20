"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { KeyRound, Share2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import {
    type ComponentType,
    type ReactNode,
    useEffect,
    useRef,
    useState,
} from "react";
import { toast } from "sonner";
import { ApproveTypeButton } from "@/components/shared/approve-type";
import { ManageAccessDialog } from "@/components/shared/manage-access";
import { PendingBadge, PendingBanner } from "@/components/shared/pending";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useServiceSync } from "@/hooks";
import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import { copyText } from "@/lib/clipboard";
import type { Me, Verification } from "@/lib/cloud-registry.types";
import { isVerificationMismatch, mutationError } from "@/lib/errors";
import { failuresHref } from "@/lib/failures";
import {
    canApproveServiceType,
    canChangeSelfListing,
    canDeleteService,
    canEditService,
    canManageAccess,
    canVerifyService,
} from "@/lib/permissions";
import { Breakable } from "./service-dailog-card-misc";
import ServiceSyncSection from "./service-sync-section";
import SyncBadge from "./sync-badge";
import VerifiedBadge from "./verified-badge";
import ViewServiceDialogBody from "./view-service-dailog-body";

type SlotProps = { className?: string; children?: ReactNode };

type Props = {
    service: ExternalService;
    verification?: Verification;
    // false while the verification loads, as it is undefined until then
    verificationLoaded?: boolean;
    // undefined if unknown, see getServiceWithApproval
    pending?: boolean;
    cloudRegistryProvider: AuthenticatedCloudRegistryProvider | null;
    me: Me | null;
    // e.g. DialogTitle in a dialog, CardTitle on a page
    Title: ComponentType<SlotProps>;
    Description: ComponentType<SlotProps>;
    // after a verification or approval, or a delete after unmounting
    onChange: () => void;
    // after a change of access, which may change the user's own roles
    onAccessChange: () => void;
    // e.g. close the dialog, or leave the page
    onDeleted: () => void;
};

/** url of the service's page, to share it */
function servicePageUrl(serviceId: string) {
    return `${window.location.origin}/dashboard/services/view/${encodeURIComponent(serviceId)}`;
}

/**
 * an icon button of the header, in the style of the dialog's close button,
 * with its label as tooltip; the child (a button or a link) carries the
 * label for screen readers
 */
function HeaderAction({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="bg-secondary"
                    asChild
                >
                    {children}
                </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

/** details and actions of a service, the same in the dialog of the list and on the service's page */
function ServiceDetails({
    service,
    verification,
    verificationLoaded = true,
    pending,
    cloudRegistryProvider,
    me,
    Title,
    Description,
    onChange,
    onAccessChange,
    onDeleted,
}: Props) {
    const {
        sync,
        loaded: syncLoaded,
        failed: syncFailed,
        setSync,
        reload: reloadSync,
    } = useServiceSync(service.id);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [manageOpen, setManageOpen] = useState(false);
    // the link to copy by hand, if the browser can't copy it
    const [shareUrl, setShareUrl] = useState<string>();
    // false once the dialog is closed or the page is left, e.g. while a
    // delete is still running
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const canEdit = canEditService(me, service.id);
    const canDelete = canDeleteService(me, service.id);
    const manageAccess = canManageAccess(me, service.id);
    // the registry hides the verifications of pending services from the
    // public reads, so their state is unknown until the approval
    const canVerify =
        canVerifyService(me) && pending === false && verificationLoaded;
    const canApprove = !!pending && canApproveServiceType(me);
    const hasServiceActions = canApprove || canVerify || canEdit || canDelete;

    const handleShare = () => {
        const url = servicePageUrl(service.id);
        // the field below the title, as toasts can't be reached while a
        // dialog is open
        const showUrl = () => {
            setShareUrl(url);
            toast.error(
                "Cannot copy the link. Copy it from the field below the title.",
            );
        };
        copyText(url)
            .then(() => {
                setShareUrl(undefined);
                toast.success("Copied the link to this service.");
            })
            .catch(showUrl);
    };

    const handleServiceDelete = async () => {
        if (!cloudRegistryProvider) return;
        setIsDeleting(true);

        const promise = cloudRegistryProvider.deleteService(service.id);

        toast.promise(promise, {
            loading: `Deleting service with ID - ${service.id}`,
            success: (response) => `Deleted service with ID - ${response}`,
            error: (err) =>
                mutationError(err, "Cannot delete service currently."),
        });

        try {
            await promise;
            // stays disabled until the dialog closes or the page is left;
            // if that happened already, e.g. another service's dialog may
            // be open now, so only refresh the data
            if (mounted.current) onDeleted();
            else onChange();
        } catch {
            // toast.promise shows the error
            setIsDeleting(false);
        }
    };

    const handleServiceVerify = async () => {
        if (!cloudRegistryProvider) return;
        setIsVerifying(true);

        const removing = !!verification;
        const promise = removing
            ? cloudRegistryProvider.removeServiceVerification(service.id)
            : cloudRegistryProvider.verifyService(service.id, {
                  url: service.url,
                  type: service.type,
              });

        toast.promise(promise, {
            loading: removing
                ? `Removing verification of service with ID - ${service.id}`
                : `Verifying service with ID - ${service.id}`,
            success: removing
                ? `Removed verification of service with ID - ${service.id}`
                : `Verified service with ID - ${service.id}`,
            error: (err) =>
                isVerificationMismatch(err)
                    ? "The service changed after it was checked. Please check it again."
                    : mutationError(
                          err,
                          removing
                              ? "Cannot remove the verification currently."
                              : "Cannot verify service currently.",
                      ),
        });

        try {
            await promise;
        } catch {
            // toast.promise shows the error
        } finally {
            onChange();
            setIsVerifying(false);
        }
    };

    return (
        <>
            {/* the classes of DialogHeader, the same in the dialog and on the
                page; in the dialog, the text and the buttons keep clear of
                its close button, so that the buttons sit next to it */}
            <div className="flex flex-col gap-3 px-4 py-4 in-data-[slot=dialog-content]:pr-14 border-b">
                <div className="flex items-start gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <Title className="text-lg font-bold leading-none">
                            Service Details
                        </Title>
                        <Description className="wrap-break-word">
                            Complete metadata of the service{" "}
                            <Breakable value={service.id} />.
                        </Description>
                        {(verification || sync || pending) && (
                            <div className="flex gap-2">
                                {verification && <VerifiedBadge />}
                                {sync && <SyncBadge status={sync.status} />}
                                {pending && <PendingBadge />}
                            </div>
                        )}
                    </div>
                    {/* what leaves the service as it is, in the style of
                        the close button: its failed operations, for those
                        with a role on it and admins in admin mode, and
                        sharing, for all, right next to the close button */}
                    <div className="flex shrink-0 gap-2">
                        {canEdit && (
                            <HeaderAction label="Failed operations of this service">
                                <Link
                                    href={failuresHref({
                                        serviceId: service.id,
                                    })}
                                    aria-label="Failed operations of this service"
                                >
                                    <TriangleAlert />
                                </Link>
                            </HeaderAction>
                        )}
                        <HeaderAction label="Share link">
                            <button
                                type="button"
                                aria-label="Share link"
                                onClick={handleShare}
                            >
                                <Share2 />
                            </button>
                        </HeaderAction>
                    </div>
                </div>
                {shareUrl && (
                    <Input
                        readOnly
                        value={shareUrl}
                        aria-label="Link to this service"
                        onFocus={(e) => e.target.select()}
                    />
                )}
            </div>

            {/* the text of the banner may shrink below its longest word, e.g.
                a long service type, which then breaks instead of widening
                the dialog */}
            {pending && (
                <div className="px-6 pt-5 [&_p]:min-w-0">
                    <PendingBanner
                        serviceType={service.type}
                        admin={me?.admin}
                        canEdit={canEdit}
                        canDelete={canDelete}
                    />
                </div>
            )}

            <ServiceSyncSection
                serviceId={service.id}
                sync={sync}
                loaded={syncLoaded}
                failed={syncFailed}
                canManage={canEdit}
                mayReadListing={canChangeSelfListing(me)}
                provider={cloudRegistryProvider}
                onSyncChange={(state) => {
                    setSync(state);
                    onChange();
                }}
                onRefresh={() => {
                    reloadSync();
                    onChange();
                }}
            />

            <ViewServiceDialogBody
                service={service}
                verification={verification}
            />

            {/* the actions that change the service, the same in the dialog
                and on the page, in one row also on phones: access on the
                left (only its icon on phones, the tooltip names it), the
                actions on the service itself on the right */}
            {(manageAccess || hasServiceActions) && (
                <div className="flex flex-wrap gap-2 px-4 py-4 border-t">
                    {manageAccess && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    size="sm"
                                    variant={"outline"}
                                    aria-label="Manage access"
                                    onClick={() => setManageOpen(true)}
                                >
                                    <KeyRound />
                                    <span className="hidden sm:inline">
                                        Access
                                    </span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Manage access</TooltipContent>
                        </Tooltip>
                    )}
                    {hasServiceActions && (
                        <div className="ml-auto flex flex-wrap justify-end gap-2">
                            {canApprove && (
                                <ApproveTypeButton
                                    serviceType={service.type}
                                    provider={cloudRegistryProvider}
                                    onApproved={onChange}
                                />
                            )}
                            {canVerify && (
                                <Button
                                    size="sm"
                                    variant={"outline"}
                                    onClick={handleServiceVerify}
                                    disabled={isVerifying}
                                >
                                    {verification ? "Unverify" : "Verify"}
                                </Button>
                            )}
                            {canEdit && (
                                <Button size="sm" asChild>
                                    <Link
                                        href={`/dashboard/services/update/${encodeURIComponent(service.id)}`}
                                    >
                                        Edit
                                    </Link>
                                </Button>
                            )}
                            {canDelete && (
                                <Button
                                    size="sm"
                                    variant={"destructive"}
                                    onClick={handleServiceDelete}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {manageAccess && manageOpen && (
                <ManageAccessDialog
                    provider={cloudRegistryProvider}
                    serviceId={service.id}
                    currentUserId={me?.userId}
                    open={manageOpen}
                    onOpenChange={setManageOpen}
                    onChange={onAccessChange}
                />
            )}
        </>
    );
}

export default ServiceDetails;
