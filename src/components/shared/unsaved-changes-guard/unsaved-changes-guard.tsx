"use client";
import { useEffect, useRef, useState } from "react";
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

// the parts of the Navigation API used here (not in TypeScript's DOM types)
type NavigateEvent = Event & {
    navigationType: string;
    cancelable: boolean;
    destination: { key: string };
};
type Navigation = EventTarget & {
    traverseTo: (key: string) => { finished: Promise<unknown> };
};

type Props = {
    when: boolean;
};

/** asks before links, back/forward (Navigation API only) or tab close leave the page */
function UnsavedChangesGuard({ when }: Props) {
    const [leave, setLeave] = useState<() => void>();
    const leaving = useRef(false);

    useEffect(() => {
        if (!when) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (leaving.current) return;
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [when]);

    // runs before the click reaches Next's Link handler
    useEffect(() => {
        if (!when) return;
        const onClick = (e: MouseEvent) => {
            if (leaving.current || e.defaultPrevented || e.button !== 0) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const anchor = e
                .composedPath()
                .find(
                    (el): el is HTMLAnchorElement =>
                        el instanceof HTMLAnchorElement && el.href !== "",
                );
            if (!anchor || anchor.hasAttribute("download")) return;
            if (anchor.target && anchor.target !== "_self") return;
            const url = new URL(anchor.href);
            if (
                url.origin === window.location.origin &&
                url.pathname === window.location.pathname &&
                url.search === window.location.search
            )
                return;
            e.preventDefault();
            e.stopPropagation();
            setLeave(() => () => {
                const from = window.location.href;
                leaving.current = true;
                anchor.click();
                // guard again if the link didn't leave the page
                setTimeout(() => {
                    if (window.location.href === from) leaving.current = false;
                }, 5000);
            });
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, [when]);

    // browsers without the Navigation API leave on back/forward unasked
    useEffect(() => {
        const navigation = (window as { navigation?: Navigation }).navigation;
        if (!when || !navigation) return;
        const onNavigate = (event: Event) => {
            const e = event as NavigateEvent;
            if (leaving.current || e.navigationType !== "traverse") return;
            if (!e.cancelable) return;
            e.preventDefault();
            const { key } = e.destination;
            setLeave(() => () => {
                leaving.current = true;
                // guard again if this page is still shown afterwards
                navigation
                    .traverseTo(key)
                    .finished.catch(() => {})
                    .finally(() => {
                        leaving.current = false;
                    });
            });
        };
        navigation.addEventListener("navigate", onNavigate);
        return () => navigation.removeEventListener("navigate", onNavigate);
    }, [when]);

    return (
        <AlertDialog
            open={leave !== undefined}
            onOpenChange={(open) => {
                if (!open) setLeave(undefined);
            }}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have unsaved changes. Leave this page?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Stay</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        onClick={() => leave?.()}
                    >
                        Leave
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default UnsavedChangesGuard;
