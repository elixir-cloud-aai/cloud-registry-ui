"use client";
import type {
    EccServiceCreatedEvent,
    EccServiceCreateFailedEvent,
    EccServiceCreateValidationFailedEvent,
    EccServiceFormChangedEvent,
} from "@elixir-cloud/cloud-registry/events";
import { ECCClientElixirCloudRegistryServiceCreate } from "@elixir-cloud/cloud-registry/react";
import { ClockIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { UnsavedChangesGuard } from "@/components/shared/unsaved-changes-guard";
import { useCloudRegistry, useMe, useRegistrationRules } from "@/hooks";
import { unknownRegistrationRules } from "@/lib/registration-rules";
import { checkedProvider, createFailedToast } from "@/lib/service-create";
import { servicesLimit } from "@/lib/service-limits";

function Page() {
    const router = useRouter();
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const { me, loading, error, expired } = useMe();
    const [changed, setChanged] = useState(false);
    // the registry's limit of services per user, for its 409; read in
    // advance, as the service info is the same for all users
    const [limit, setLimit] = useState<number>();
    // the registry's rules for the checks before sending; until they are
    // read, the registry checks what depends on them
    const { rules, loading: rulesLoading } = useRegistrationRules();
    const checkRules = useRef(unknownRegistrationRules);
    useEffect(() => {
        checkRules.current = rulesLoading ? unknownRegistrationRules : rules;
    }, [rules, rulesLoading]);
    // the form only checks that the required fields are filled in, so the
    // client checks the rest before sending (cloud-components has no hook
    // for it); the same client for new rules, as the form reloads its types
    // for another one
    const provider = useMemo(
        () =>
            cloudRegistryProvider &&
            checkedProvider(cloudRegistryProvider, () => checkRules.current),
        [cloudRegistryProvider],
    );

    useEffect(() => {
        let current = true;
        servicesLimit(cloudRegistryProvider).then((val) => {
            if (current) setLimit(val);
        });
        return () => {
            current = false;
        };
    }, [cloudRegistryProvider]);

    useEffect(() => {
        if (error && !expired)
            toast.error(
                "Could not check your permissions. Please try again later.",
            );
    }, [error, expired]);

    const onServiceCreated = (e: EccServiceCreatedEvent) => {
        const { serviceId, serviceData } = e.detail;
        setChanged(false);
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
        router.replace("/dashboard/services");
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
        setChanged(e.detail.dirty);
    };

    if (provider === null) return;

    if (!isLoggedIn)
        return <LoginPrompt message="Log in to register a service" />;

    if (expired)
        return (
            <LoginPrompt message="Your session expired. Please log in again." />
        );

    // the form shows before `GET /me` has loaded, and follows later changes
    // of `admin`, `allowNewType` and the provider.
    // The registry decides who may add types: while `GET /me` loads, only
    // listed types are offered; without its answer (e.g. after an error, or
    // from registries without the flag), new ones are, too
    const allowNewType = !loading && me?.may_add_service_types !== false;

    return (
        <div className="max-w-5xl mx-auto mt-5 md:mt-8">
            <UnsavedChangesGuard when={changed} />
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

export default Page;
