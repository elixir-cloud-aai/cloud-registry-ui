"use client";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { useCloudRegistry, useUserInfo } from "@/hooks";
import type { ServiceRole } from "@/lib/cloud-registry.types";
import {
    acceptInvitationError,
    dropPendingToken,
    invitationPath,
    invitationToken,
    keepPendingToken,
    pendingToken,
} from "@/lib/invitations";
import { isUnauthorized } from "@/lib/permissions";

const storage = () => window.sessionStorage;

/**
 * Accept an invitation to a service: the link carries the token in its
 * fragment, which browsers don't send to servers; guests log in first, and
 * the tab keeps the token meanwhile
 */
function Page() {
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const { user } = useUserInfo();
    // undefined while reading, null without one
    const [token, setToken] = useState<string | null>();
    const [accepting, setAccepting] = useState(false);
    const [accepted, setAccepted] = useState<ServiceRole>();
    const [failure, setFailure] = useState<string>();
    const [expired, setExpired] = useState(false);

    useEffect(() => {
        // also when another link is opened on this page, which changes
        // only the fragment
        const read = () => {
            const hash = window.location.hash.replace(/^#/, "");
            let next = pendingToken(storage) ?? null;
            if (hash) {
                next = invitationToken(hash) ?? null;
                if (next) keepPendingToken(storage, next);
                // out of the address bar, the history and shared screens
                window.history.replaceState(
                    window.history.state,
                    "",
                    invitationPath,
                );
            }
            setToken(next);
            setAccepted(undefined);
            setFailure(undefined);
            setExpired(false);
        };
        read();
        window.addEventListener("hashchange", read);
        return () => window.removeEventListener("hashchange", read);
    }, []);

    const accept = () => {
        if (!cloudRegistryProvider || !token) return;
        setAccepting(true);
        setFailure(undefined);
        cloudRegistryProvider
            .acceptInvitation(token)
            .then((role) => {
                dropPendingToken(storage);
                setAccepted(role);
            })
            .catch((err) => {
                const { message, final } = acceptInvitationError(err);
                if (final) {
                    dropPendingToken(storage);
                    setToken(null);
                }
                setExpired(isUnauthorized(err));
                setFailure(message);
            })
            .finally(() => setAccepting(false));
    };

    let content: React.ReactNode;
    if (token === undefined || cloudRegistryProvider === null)
        content = <p className="text-sm text-muted-foreground">Loading...</p>;
    else if (accepted)
        content = (
            <>
                <CardHeader>
                    <CardTitle>Invitation accepted</CardTitle>
                    <CardDescription>
                        You are now {accepted.role} of {accepted.service_id}.
                    </CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button asChild>
                        <Link
                            href={`/dashboard/services/view/${encodeURIComponent(accepted.service_id)}`}
                        >
                            View service
                        </Link>
                    </Button>
                </CardFooter>
            </>
        );
    else if (token === null)
        content = (
            <CardHeader>
                <CardTitle>No invitation to accept</CardTitle>
                <CardDescription>
                    {failure ??
                        "Open the whole link that you were sent; it ends with the invitation's code."}
                </CardDescription>
            </CardHeader>
        );
    else if (!isLoggedIn || expired)
        content = (
            <LoginPrompt
                message={
                    expired
                        ? "Your session expired. Log in again to accept the invitation."
                        : "Log in to accept the invitation to a service."
                }
                next={invitationPath}
            />
        );
    else
        content = (
            <>
                <CardHeader>
                    <CardTitle>Accept the invitation</CardTitle>
                    <CardDescription>
                        You were invited to a service. Accepting gives{" "}
                        {user?.name || user?.email || "your account"} the role
                        that the invitation is for, and replaces any other role
                        of yours on the service.
                    </CardDescription>
                </CardHeader>
                {failure && (
                    <CardContent>
                        <p role="alert" className="text-sm text-destructive">
                            {failure}
                        </p>
                    </CardContent>
                )}
                <CardFooter>
                    <Button onClick={accept} disabled={accepting}>
                        <MailCheck />
                        Accept invitation
                    </Button>
                </CardFooter>
            </>
        );

    return (
        <div className="flex justify-center items-center min-h-screen px-4">
            <Card className="w-full max-w-md">
                {content}
                <CardFooter>
                    <Button asChild variant="link" className="px-0">
                        <Link href="/dashboard/services">
                            Go to the services
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

export default Page;
