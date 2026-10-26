"use client";
import type { ExternalService } from "@elixir-cloud/cloud-registry/providers";
import { KeyRound, Share2 } from "lucide-react";
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
import type { AuthenticatedCloudRegistryProvider } from "@/lib/authenticated-cloud-registry";
import type { Me, Verification } from "@/lib/cloud-registry.types";
import { isVerificationMismatch, mutationError } from "@/lib/errors";
import {
    canApproveServiceType,
    canDeleteService,
    canEditService,
    canManageAccess,
    canVerifyService,
} from "@/lib/permissions";
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

    const handleShare = () => {
        const url = servicePageUrl(service.id);
        // the field below the actions, as toasts can't be reached while a
        // dialog is open
        const showUrl = () => {
            setShareUrl(url);
            toast.error("Cannot copy the link. Copy it from the field below.");
        };
        // missing outside secure contexts (HTTPS or localhost)
        if (!navigator.clipboard) return showUrl();
        navigator.clipboard
            .writeText(url)
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
            {/* the classes of DialogHeader, the same in the dialog and on the page */}
            <div className="flex flex-col gap-1.5 px-4 py-4 border-b">
                <Title className="text-lg font-bold leading-none">
                    Artifact Details
                </Title>
                <Description>
                    Complete metadata for {service.id} deployment.
                </Description>
                {(verification || pending) && (
                    <div className="flex gap-2">
                        {verification && <VerifiedBadge />}
                        {pending && <PendingBadge />}
                    </div>
                )}
            </div>

            {pending && (
                <div className="px-6 pt-5">
                    <PendingBanner
                        serviceType={service.type}
                        admin={me?.admin}
                        canEdit={canEdit}
                        canDelete={canDelete}
                    />
                </div>
            )}

            <ViewServiceDialogBody
                service={service}
                verification={verification}
            />

            {/* the classes of DialogFooter, the same in the dialog and on the page */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end px-4 py-4 border-t">
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
                <Button size="sm" variant={"outline"} onClick={handleShare}>
                    <Share2 />
                    Share
                </Button>
                {manageAccess && (
                    <Button
                        size="sm"
                        variant={"outline"}
                        onClick={() => setManageOpen(true)}
                    >
                        <KeyRound />
                        Manage access
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

            {shareUrl && (
                <div className="px-4 pb-4">
                    <Input
                        readOnly
                        value={shareUrl}
                        aria-label="Link to this service"
                        onFocus={(e) => e.target.select()}
                    />
                </div>
            )}

            {manageAccess && manageOpen && (
                <ManageAccessDialog
                    provider={cloudRegistryProvider}
                    serviceId={service.id}
                    currentUserId={me?.user_id}
                    open={manageOpen}
                    onOpenChange={setManageOpen}
                    onChange={onAccessChange}
                />
            )}
        </>
    );
}

export default ServiceDetails;
