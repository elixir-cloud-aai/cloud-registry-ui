import { useEffect, useState } from "react";
import {
    defaultRegistrationRules,
    type RegistrationRules,
    readRegistrationRules,
    unknownRegistrationRules,
} from "@/lib/registration-rules";
import { useCloudRegistry } from "./use-cloud-registry";

/**
 * Read the registry's registration rules from its service info
 * @returns `rules`: the rules; the registry's defaults while `loading`; if
 * they are unknown (`error`: the service info can't be read, or the
 * registry publishes no rules), rules that leave the checks to the
 * registry (`unknownRegistrationRules`). They are read once per mount, as
 * soon as the registry's client is set up (right after mounting), so
 * changes of the registry apply on the next page load; the read is aborted
 * on unmount
 */
function useRegistrationRules() {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [rules, setRules] = useState<RegistrationRules>();
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!cloudRegistryProvider) return;
        const controller = new AbortController();
        const { signal } = controller;
        readRegistrationRules(cloudRegistryProvider, { signal }).then((val) => {
            if (signal.aborted) return;
            setRules(val ?? unknownRegistrationRules);
            setError(val === undefined);
        });
        return () => controller.abort();
    }, [cloudRegistryProvider]);

    return {
        rules: rules ?? defaultRegistrationRules,
        loading: rules === undefined,
        error,
    };
}

export { useRegistrationRules };
