import { deleteCookie, getCookie, setCookie } from "cookies-next/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminModeCookie, adminModeOn, isAdminMode } from "@/lib/admin-mode";

function useAdminMode() {
    const [adminMode, setAdminModeState] = useState(false);

    // as `useCloudRegistry()` reads it for the requests, once mounted; if
    // another tab switched the mode meanwhile, pages would load data in the
    // other mode, so the page asks once to be loaded again (not by itself,
    // which would drop unsaved changes)
    useEffect(() => {
        const mode = isAdminMode(getCookie(adminModeCookie));
        setAdminModeState(mode);
        let asked = false;
        const onShow = () => {
            if (asked || document.visibilityState !== "visible") return;
            if (isAdminMode(getCookie(adminModeCookie)) === mode) return;
            asked = true;
            toast.warning("The mode changed in another tab.", {
                description: "Reload this page to use it here.",
                action: {
                    label: "Reload",
                    onClick: () => window.location.reload(),
                },
                duration: Number.POSITIVE_INFINITY,
            });
        };
        document.addEventListener("visibilitychange", onShow);
        window.addEventListener("focus", onShow);
        return () => {
            document.removeEventListener("visibilitychange", onShow);
            window.removeEventListener("focus", onShow);
        };
    }, []);

    // a reload, so that every page loads its data again with or without the
    // admin role, also data that pages keep in their own state
    const setAdminMode = (on: boolean) => {
        const apply = () => {
            if (on)
                setCookie(adminModeCookie, adminModeOn, {
                    path: "/",
                    sameSite: "lax",
                    secure: window.location.protocol === "https:",
                });
            else deleteCookie(adminModeCookie, { path: "/" });
        };
        // pages with unsaved changes ask before the reload (their listeners
        // come first); then the mode changes only once the page is left, so
        // that it stays as it is if users stay, and their next input on the
        // page drops the switch
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!e.defaultPrevented) return apply();
            const drop = () => {
                window.removeEventListener("pagehide", apply);
                window.removeEventListener("pointerdown", drop, true);
                window.removeEventListener("keydown", drop, true);
            };
            window.addEventListener("pagehide", apply, { once: true });
            window.addEventListener("pointerdown", drop, true);
            window.addEventListener("keydown", drop, true);
        };
        window.addEventListener("beforeunload", onBeforeUnload, {
            once: true,
        });
        window.location.reload();
    };

    return { adminMode, setAdminMode };
}

export { useAdminMode };
