import { useEffect, useState } from "react";
import {
    defaultRegistrationRules,
    type RegistrationRules,
    readRegistrationRules,
} from "@/lib/registration-rules";
import { useCloudRegistry } from "./use-cloud-registry";

/**
 * Read the registry's registration rules from its service info
 * @returns `rules`: the rules, the registry's defaults while `loading` and
 * if they can't be read (then `error` is set)
 */
function useRegistrationRules() {
    const { cloudRegistryProvider } = useCloudRegistry();
    const [rules, setRules] = useState<RegistrationRules>();
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!cloudRegistryProvider) return;
        let current = true;
        readRegistrationRules(cloudRegistryProvider).then((val) => {
            if (!current) return;
            setRules(val ?? defaultRegistrationRules);
            setError(val === undefined);
        });
        return () => {
            current = false;
        };
    }, [cloudRegistryProvider]);

    return {
        rules: rules ?? defaultRegistrationRules,
        loading: rules === undefined,
        error,
    };
}

export { useRegistrationRules };
