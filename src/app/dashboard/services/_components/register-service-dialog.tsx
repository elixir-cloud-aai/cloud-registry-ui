"use client";
import type {
    EccServiceCreatedEvent,
    EccServiceCreateFailedEvent,
    EccServiceCreateValidationFailedEvent,
    EccServiceFormChangedEvent,
} from "@elixir-cloud/cloud-registry/events";
import type { ExternalServiceRegister } from "@elixir-cloud/cloud-registry/providers";
import { ECCClientElixirCloudRegistryServiceCreate } from "@elixir-cloud/cloud-registry/react";
import { ClockIcon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
    type ComponentRef,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
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
import {
    checkedProvider,
    createFailedToast,
    withFormRules,
} from "@/lib/service-create";
import {
    createFormValues,
    fillCreateForm,
    formSnapshot,
    type ImportValues,
    sameValues,
    syncWanted,
} from "@/lib/service-import";
import { servicesLimit } from "@/lib/service-limits";
import {
    syncFailedReason,
    syncFailedTitle,
    syncStartedMessage,
} from "@/lib/service-sync";
import { offersNewTypes, typeLabel } from "@/lib/service-types";
import ServiceInfoImport from "./service-info-import";
import ServiceSyncChoice from "./service-sync-choice";

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
    const formElement =
        useRef<ComponentRef<typeof ECCClientElixirCloudRegistryServiceCreate>>(
            null,
        );
    const syncRule = rulesLoading ? undefined : rules.serviceInfoSync;
    // registries that publish the rule can import, whether they sync or not
    const canImport = !!syncRule;
    // the imported values, while the form has them, and whether users have
    // changed them
    const [imported, setImported] = useState<ImportValues>();
    const [modified, setModified] = useState(false);
    // users' choice for imported values, if sync is available
    const [syncChecked, setSyncChecked] = useState(true);
    // a service type that the form can't take, for the note
    const [refusedType, setRefusedType] = useState<ImportValues["type"]>();
    // the form needs its types for an import
    const [typesLoaded, setTypesLoaded] = useState(false);
    // what the client needs when it sends, and what it decided: whether to
    // sync the new service, as the form is empty again once it has created it
    const syncChoice = useRef<{ values?: ImportValues; wanted: boolean }>({
        wanted: false,
    });
    const syncNew = useRef(false);
    useEffect(() => {
        syncChoice.current = {
            values: imported,
            wanted: !!syncRule?.enabled && syncChecked,
        };
    }, [imported, syncRule, syncChecked]);

    // the form only checks that the required fields are filled in, so the
    // client checks the rest before sending (cloud-components has no hook
    // for it); the same client for new rules, as the form reloads its types
    // for another one
    // which also tells while it sends, so that the modal stays open until
    // the registry has answered (requests can't be cancelled), and decides
    // whether to sync the service that it sends
    const provider = useMemo(() => {
        if (!cloudRegistryProvider) return cloudRegistryProvider;
        const checked = checkedProvider(
            withFormRules(cloudRegistryProvider),
            () => checkRules.current,
        );
        const sending = (
            service: ExternalServiceRegister,
            send: () => Promise<string>,
        ) => {
            syncNew.current = syncWanted(service, syncChoice.current);
            onSending(true);
            return send().finally(() => onSending(false));
        };
        return Object.assign(Object.create(checked), {
            createService: (service: ExternalServiceRegister) =>
                sending(service, () => checked.createService(service)),
            createServiceWithId: (
                id: string,
                service: ExternalServiceRegister,
            ) =>
                sending(service, () =>
                    checked.createServiceWithId(id, service),
                ),
            // not if they fail: every type would then look unregistered
            getServiceTypes: () =>
                checked.getServiceTypes().then(
                    (types) => {
                        setTypesLoaded(true);
                        return types;
                    },
                    (err) => {
                        setTypesLoaded(false);
                        throw err;
                    },
                ),
        }) as typeof checked;
    }, [cloudRegistryProvider, onSending]);

    useEffect(() => {
        if (error && !expired)
            toast.error(
                "Could not check your permissions. Please try again later.",
            );
    }, [error, expired]);

    // the form shows before `GET /me` has loaded, and follows later changes
    // of `admin`, `allowNewType` and the provider.
    // The registry decides who may add types (`offersNewTypes()`): while
    // `GET /me` and the rules load, only listed types are offered
    const allowNewType = !loading && !rulesLoading && offersNewTypes(me, rules);

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
        if (syncNew.current) startSync(serviceId);
    };

    // after the form has closed: the service is registered, whatever happens
    // here. Reloads the services, as the sync may have changed the values
    const startSync = (serviceId: string) => {
        cloudRegistryProvider
            ?.syncService(serviceId)
            .then((sync) => {
                const { kind, message } = syncStartedMessage(sync);
                toast[kind](message, { duration: 10000 });
            })
            .catch((err) => {
                toast.error(syncFailedTitle(err), {
                    description: `${syncFailedReason(err)} The service's page shows its sync, and can turn it on.`,
                    duration: 15000,
                });
            })
            .finally(onRegistered);
    };

    const handleImport = async (serviceInfoUrl: string) => {
        if (!cloudRegistryProvider) return;
        const form = formElement.current;
        const before = formSnapshot(form);
        const values =
            await cloudRegistryProvider.importServiceInfo(serviceInfoUrl);
        // what the form has pending, e.g. types loaded just now
        await form?.updateComplete;
        if (formSnapshot(form) !== before) {
            toast.info(
                "The form changed during the import, so it keeps your entries. Import again to replace them.",
            );
            return;
        }
        // the form reports the new values before the state below applies
        syncChoice.current = { ...syncChoice.current, values };
        const { filled, typeOffered } = fillCreateForm(
            form,
            values,
            allowNewType,
        );
        if (!filled) {
            syncChoice.current = { ...syncChoice.current, values: undefined };
            throw new Error("The form can't take the imported values.");
        }
        setImported(values);
        setModified(!typeOffered);
        setSyncChecked(true);
        setRefusedType(typeOffered ? undefined : values.type);
        toast.success(
            "Imported the service info. Check the values, then create the service.",
        );
    };

    const onServiceCreationFailed = async (e: EccServiceCreateFailedEvent) => {
        const { message, ...data } = await createFailedToast(e.detail, {
            limit,
            readLimit: () => servicesLimit(cloudRegistryProvider),
            adminAvailable: !!me?.adminAvailable && !me.admin,
        });
        toast.error(message, data);
    };

    const onValidationError = (e: EccServiceCreateValidationFailedEvent) => {
        toast.error(e.detail.error);
    };

    const onFormChanged = (e: EccServiceFormChangedEvent) => {
        onChange(e.detail.dirty);
        const { values } = syncChoice.current;
        if (!values) return;
        // an empty form (**Reset**, or after creating a service) has no
        // imported values anymore
        if (!e.detail.dirty) {
            syncChoice.current = { ...syncChoice.current, values: undefined };
            setImported(undefined);
            setModified(false);
            setRefusedType(undefined);
            return;
        }
        const current = createFormValues(formElement.current);
        setModified(!current || !sameValues(current, values));
        if (current?.type.artifact) setRefusedType(undefined);
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

    return (
        <div className="min-w-0">
            {allowNewType && me?.serviceTypesPending && (
                <p className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                    <ClockIcon className="size-4 shrink-0" />
                    New service types are pending until an admin approves them,
                    and so are the services that have them.
                </p>
            )}
            {/* registries older than cloud-registry 1.0.0rc2 can't import */}
            {canImport && (
                <ServiceInfoImport
                    disabled={loading || rulesLoading || !typesLoaded}
                    onImport={handleImport}
                />
            )}
            {refusedType && (
                <p className="flex items-start gap-2 mb-4 text-sm text-destructive">
                    <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0 wrap-anywhere">
                        The service type {typeLabel(refusedType)} isn't
                        registered, and you may not add it. Choose a registered
                        type, or ask an admin to add it and import again.
                    </span>
                </p>
            )}
            <ECCClientElixirCloudRegistryServiceCreate
                ref={formElement}
                admin={!!me?.admin}
                allowNewType={allowNewType}
                onEccServiceCreated={onServiceCreated}
                onEccServiceCreateFailed={onServiceCreationFailed}
                onEccServiceCreateValidationFailed={onValidationError}
                onEccServiceFormChanged={onFormChanged}
                provider={provider}
            />
            {syncRule?.enabled && (
                <ServiceSyncChoice
                    intervalHours={syncRule.intervalHours}
                    imported={!!imported}
                    modified={modified}
                    typeRefused={!!refusedType}
                    checked={syncChecked}
                    onCheckedChange={setSyncChecked}
                />
            )}
        </div>
    );
}

/** The modal "Register Service" of the Services page, with the create form;
 * closing it with unsaved input asks first, and so do leaving the page and
 * closing the tab */
function RegisterServiceDialog({ open, onOpenChange, onRegistered }: Props) {
    const [changed, setChanged] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);
    // a ref, not state: Esc may come before React renders the change
    const sending = useRef(false);
    const onSending = useCallback((val: boolean) => {
        sending.current = val;
    }, []);
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
                    if (val || sending.current) return;
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
                        onSending={onSending}
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
