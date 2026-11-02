"use client";
import type {
    EccServiceCreatedEvent,
    EccServiceCreateFailedEvent,
    EccServiceCreateValidationFailedEvent,
    EccServiceFormChangedEvent,
} from "@elixir-cloud/cloud-registry/events";
import type { ExternalServiceRegister } from "@elixir-cloud/cloud-registry/providers";
import { ECCClientElixirCloudRegistryServiceCreate } from "@elixir-cloud/cloud-registry/react";
import { ClockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useCloudRegistry, useMe, useRegistrationRules } from "@/hooks";
import { unknownRegistrationRules } from "@/lib/registration-rules";
import { checkedProvider, createFailedToast } from "@/lib/service-create";
import { servicesLimit } from "@/lib/service-limits";
import { offersNewTypes } from "@/lib/service-types";

/** The link that opens the create form (`/dashboard/services/create`
 * redirects to it); the login returns to that path */
const registerPath = "/dashboard/services/create";

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** After a registration, e.g. to load the services again */
    onRegistered?: () => void;
};

type FormProps = {
    onChange: (dirty: boolean) => void;
    /** While a registration is being sent */
    onSending: (sending: boolean) => void;
    onRegistered: () => void;
};

/** The create form of cloud-components, with the checks before sending,
 * or a login prompt for users who are not (or no longer) logged in */
function RegisterServiceForm({ onChange, onSending, onRegistered }: FormProps) {
    const router = useRouter();
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const { me, loading, error, expired } = useMe();
    // the registry's rules, read in advance, as the service info is the
    // same for all users: for the checks before sending (until they are
    // read, the registry checks what depends on them) and the limit of
    // services per user, for its 409
    const { rules, loading: rulesLoading } = useRegistrationRules();
    const limit = rulesLoading ? undefined : rules.maxServicesPerUser;
    const checkRules = useRef(unknownRegistrationRules);
    useEffect(() => {
        checkRules.current = rulesLoading ? unknownRegistrationRules : rules;
    }, [rules, rulesLoading]);
    // the form only checks that the required fields are filled in, so the
    // client checks the rest before sending (cloud-components has no hook
    // for it); the same client for new rules, as the form reloads its types
    // for another one
    // which also tells while it sends, so that the modal stays open until
    // the registry has answered (requests can't be cancelled)
    const provider = useMemo(() => {
        if (!cloudRegistryProvider) return cloudRegistryProvider;
        const checked = checkedProvider(
            cloudRegistryProvider,
            () => checkRules.current,
        );
        const sending = (send: () => Promise<string>) => {
            onSending(true);
            return send().finally(() => onSending(false));
        };
        return Object.assign(Object.create(checked), {
            createService: (service: ExternalServiceRegister) =>
                sending(() => checked.createService(service)),
            createServiceWithId: (
                id: string,
                service: ExternalServiceRegister,
            ) => sending(() => checked.createServiceWithId(id, service)),
        }) as typeof checked;
    }, [cloudRegistryProvider, onSending]);

    useEffect(() => {
        if (error && !expired)
            toast.error(
                "Could not check your permissions. Please try again later.",
            );
    }, [error, expired]);

    const onServiceCreated = (e: EccServiceCreatedEvent) => {
        const { serviceId, serviceData } = e.detail;
        toast.success(`Registered ${serviceData.name} with ID - ${serviceId}`, {
            action: {
                label: "View service",
                onClick: () =>
                    router.push(
                        `/dashboard/services/view/${encodeURIComponent(serviceId)}`,
                    ),
            },
            duration: 10000,
        });
        onRegistered();
    };

    const onServiceCreationFailed = async (e: EccServiceCreateFailedEvent) => {
        const { message, ...data } = await createFailedToast(e.detail, {
            limit,
            readLimit: () => servicesLimit(cloudRegistryProvider),
            adminAvailable: !!me?.admin_available && !me.admin,
        });
        toast.error(message, data);
    };

    const onValidationError = (e: EccServiceCreateValidationFailedEvent) => {
        toast.error(e.detail.error);
    };

    const onFormChanged = (e: EccServiceFormChangedEvent) => {
        onChange(e.detail.dirty);
    };

    if (provider === null) return null;

    if (!isLoggedIn)
        return (
            <LoginPrompt
                message="Log in to register a service"
                next={registerPath}
                className="mt-4"
            />
        );

    if (expired)
        return (
            <LoginPrompt
                message="Your session expired. Please log in again."
                next={registerPath}
                className="mt-4"
            />
        );

    // the form shows before `GET /me` has loaded, and follows later changes
    // of `admin`, `allowNewType` and the provider.
    // The registry decides who may add types (`offersNewTypes()`): while
    // `GET /me` and the rules load, only listed types are offered
    const allowNewType = !loading && !rulesLoading && offersNewTypes(me, rules);

    return (
        <div className="min-w-0">
            {allowNewType && me?.service_types_pending && (
                <p className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                    <ClockIcon className="size-4 shrink-0" />
                    New service types are pending until an admin approves them,
                    and so are the services that have them.
                </p>
            )}
            <ECCClientElixirCloudRegistryServiceCreate
                admin={!!me?.admin}
                allowNewType={allowNewType}
                onEccServiceCreated={onServiceCreated}
                onEccServiceCreateFailed={onServiceCreationFailed}
                onEccServiceCreateValidationFailed={onValidationError}
                onEccServiceFormChanged={onFormChanged}
                provider={provider}
            />
        </div>
    );
}

/** The modal "Register Service" of the Services page, with the create form;
 * closing it with unsaved input asks first, and so do leaving the page and
 * closing the tab */
function RegisterServiceDialog({ open, onOpenChange, onRegistered }: Props) {
    const [changed, setChanged] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);
    const [sending, setSending] = useState(false);
    // each opening gets a new form: a form closed while it was sending
    // still reports (cloud-components' listeners outlive it), and must
    // neither change nor close the current one
    const [form, setForm] = useState(0);
    const current = useRef(0);

    const close = () => {
        current.current++;
        setForm(current.current);
        setChanged(false);
        setConfirmClose(false);
        onOpenChange(false);
    };

    return (
        <>
            <UnsavedChangesGuard when={open && changed} />
            <Dialog
                open={open}
                // opened by the page only: Radix asks only to close it
                onOpenChange={(val) => {
                    // nor while the registration is being sent
                    if (val || sending) return;
                    if (changed) setConfirmClose(true);
                    else close();
                }}
            >
                {/* scrolls if the form is taller than the viewport, never
                    sideways */}
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
                    <DialogHeader className="pr-10">
                        <DialogTitle className="text-lg font-bold">
                            Register Service
                        </DialogTitle>
                        <DialogDescription>
                            Add your service to the registry; you become its
                            owner.
                        </DialogDescription>
                    </DialogHeader>
                    <RegisterServiceForm
                        key={form}
                        onSending={setSending}
                        onChange={(dirty) => {
                            if (form === current.current) setChanged(dirty);
                        }}
                        onRegistered={() => {
                            if (form === current.current) close();
                            // registered all the same
                            onRegistered?.();
                        }}
                    />
                </DialogContent>
            </Dialog>
            <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes. Discard them?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Stay</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            onClick={close}
                        >
                            Discard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

export default RegisterServiceDialog;
