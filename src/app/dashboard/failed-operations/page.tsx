"use client";
import { XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { LoginPrompt } from "@/components/shared/login-prompt";
import { PageSubtitle } from "@/components/shared/page-subtitle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useCloudRegistry, useLatestRequest, useMe } from "@/hooks";
import { isAborted } from "@/lib/abort";
import type { Failure } from "@/lib/cloud-registry.types";
import {
    appendFailures,
    type FailuresError,
    type FailuresFilter,
    failedOperations,
    failureActor,
    failureReasonLabel,
    failureReasons,
    failureReasonText,
    failuresError,
    failuresHref,
    maxServiceIdLength,
    operationLabel,
    readFailuresFilter,
} from "@/lib/failures";
import { timeAgo } from "@/lib/notifications";

// as many as the registry lists by default
const pageSize = 50;
const anyValue = "any";

/** What the list shows */
type ListState =
    | { kind: "loading" }
    | {
          kind: "loaded";
          failures: Failure[];
          nextPageToken?: string;
          loadingMore: boolean;
          moreFailed?: string;
      }
    | FailuresError;

/** One failure in the list */
function FailureRow({
    failure,
    showUser,
    admin,
}: {
    failure: Failure;
    showUser: boolean;
    /** Whether the user is an admin in admin mode */
    admin: boolean;
}) {
    const time = timeAgo(failure.occurredAt);
    const date = Date.parse(failure.occurredAt);
    return (
        <TableRow className="align-top">
            <TableCell className="whitespace-nowrap">
                <time
                    dateTime={failure.occurredAt}
                    title={
                        Number.isNaN(date)
                            ? undefined
                            : new Date(date).toLocaleString()
                    }
                >
                    {time ?? "Unknown"}
                </time>
            </TableCell>
            <TableCell>{operationLabel(failure.operation)}</TableCell>
            <TableCell className="min-w-64 max-w-md whitespace-normal">
                <p className="font-medium">
                    {failureReasonLabel(failure.reason)}
                </p>
                <p className="text-muted-foreground">
                    {failureReasonText(failure.reason)}
                </p>
                {!!failure.fields?.length && (
                    <p className="mt-1">
                        Invalid:{" "}
                        {failure.fields.map((field, i) => (
                            <span key={field}>
                                {i > 0 && ", "}
                                <code>{field}</code>
                            </span>
                        ))}
                    </p>
                )}
            </TableCell>
            <TableCell className="min-w-48 max-w-sm whitespace-normal wrap-anywhere">
                {failure.serviceId && (
                    <Link
                        href={`/dashboard/services/view/${encodeURIComponent(failure.serviceId)}`}
                        className="text-primary underline underline-offset-2"
                    >
                        {failure.serviceId}
                    </Link>
                )}
                {failure.url && (
                    <p className="text-muted-foreground">{failure.url}</p>
                )}
                {!failure.serviceId && !failure.url && (
                    <span className="text-muted-foreground">Unknown</span>
                )}
            </TableCell>
            {showUser && (
                <TableCell className="max-w-48 whitespace-normal wrap-anywhere">
                    {failure.userId ?? (
                        <span className="text-muted-foreground">
                            {failureActor(failure, admin)}
                        </span>
                    )}
                </TableCell>
            )}
        </TableRow>
    );
}

/**
 * Failed imports, registrations, updates and syncs, for those who can't read
 * the registry's logs: the user's own and those of their services; in admin
 * mode, all. The filters are part of the address, so that a service's page
 * can link to its failures
 */
function Page() {
    const { cloudRegistryProvider, isLoggedIn } = useCloudRegistry();
    const { me, loading: meLoading } = useMe();
    const router = useRouter();
    const searchParams = useSearchParams();
    const query = searchParams.toString();
    const [state, setState] = useState<ListState>({ kind: "loading" });
    const [serviceInput, setServiceInput] = useState("");
    // also aborted on unmount; a new filter aborts the pages of the last one
    const latestRequest = useLatestRequest();
    const { operation, reason, serviceId } = readFailuresFilter(
        new URLSearchParams(query),
    );

    useEffect(() => {
        setServiceInput(serviceId ?? "");
    }, [serviceId]);

    useEffect(() => {
        if (!cloudRegistryProvider || !isLoggedIn) return;
        const signal = latestRequest.next();
        setState({ kind: "loading" });
        cloudRegistryProvider
            .getFailures(
                { operation, reason, serviceId },
                { pageSize },
                { signal },
            )
            .then((page) => {
                if (signal.aborted) return;
                setState({
                    kind: "loaded",
                    failures: page.failures,
                    nextPageToken: page.nextPageToken,
                    loadingMore: false,
                });
            })
            .catch((err) => {
                if (signal.aborted || isAborted(err)) return;
                setState(failuresError(err));
            });
        return latestRequest.abort;
    }, [
        cloudRegistryProvider,
        isLoggedIn,
        latestRequest,
        operation,
        reason,
        serviceId,
    ]);

    const loadMore = () => {
        if (
            !cloudRegistryProvider ||
            state.kind !== "loaded" ||
            !state.nextPageToken ||
            state.loadingMore
        )
            return;
        const pageToken = state.nextPageToken;
        const signal = latestRequest.next();
        setState({ ...state, loadingMore: true, moreFailed: undefined });
        cloudRegistryProvider
            .getFailures(
                { operation, reason, serviceId },
                { pageSize, pageToken },
                { signal },
            )
            .then((page) => {
                if (signal.aborted) return;
                setState((val) =>
                    val.kind === "loaded"
                        ? {
                              kind: "loaded",
                              failures: appendFailures(
                                  val.failures,
                                  page.failures,
                              ),
                              nextPageToken: page.nextPageToken,
                              loadingMore: false,
                          }
                        : val,
                );
            })
            .catch((err) => {
                if (signal.aborted || isAborted(err)) return;
                const failed = failuresError(err);
                if (failed.kind === "login") setState(failed);
                else
                    setState((val) =>
                        val.kind === "loaded"
                            ? {
                                  ...val,
                                  loadingMore: false,
                                  moreFailed: failed.message,
                              }
                            : val,
                    );
            });
    };

    const applyFilter = (change: FailuresFilter) => {
        router.replace(
            failuresHref({ operation, reason, serviceId, ...change }),
            { scroll: false },
        );
    };

    const submitService = (e: FormEvent) => {
        e.preventDefault();
        applyFilter({ serviceId: serviceInput.trim() || undefined });
    };

    const filtered = !!(operation || reason || serviceId);
    const failures = state.kind === "loaded" ? state.failures : [];
    // who acted: only admins in admin mode and the users themselves see it
    const showUser = failures.some((val) => val.userId !== undefined);

    let content: React.ReactNode;
    if (cloudRegistryProvider === null)
        content = <p className="text-sm text-muted-foreground">Loading...</p>;
    else if (!isLoggedIn)
        content = <LoginPrompt message="Log in to see failed operations." />;
    else if (state.kind === "login")
        content = <LoginPrompt message={state.message} />;
    else if (state.kind === "loading")
        content = <p className="text-sm text-muted-foreground">Loading...</p>;
    else if (state.kind !== "loaded")
        content = (
            <p role="alert" className="text-sm text-destructive">
                {state.message}
            </p>
        );
    else if (!state.failures.length)
        content = (
            <p className="py-10 text-center text-sm text-muted-foreground">
                {filtered
                    ? "No failed operations match the filters."
                    : "No failed operations."}
            </p>
        );
    else
        content = (
            <>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>Operation</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Service</TableHead>
                            {showUser && <TableHead>User</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {state.failures.map((val) => (
                            <FailureRow
                                key={val.id}
                                failure={val}
                                showUser={showUser}
                                admin={!!me?.admin}
                            />
                        ))}
                    </TableBody>
                </Table>
                {state.moreFailed && (
                    <p role="alert" className="mt-4 text-sm text-destructive">
                        {state.moreFailed}
                    </p>
                )}
                {state.nextPageToken && (
                    <div className="mt-4 flex justify-center">
                        <Button
                            variant="outline"
                            onClick={loadMore}
                            disabled={state.loadingMore}
                        >
                            {state.loadingMore ? "Loading..." : "Load more"}
                        </Button>
                    </div>
                )}
            </>
        );

    const filtersDisabled = !isLoggedIn || state.kind === "unsupported";

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-semibold tracking-tight mt-2">
                    Failed Operations
                </h2>
                <PageSubtitle
                    me={me}
                    loading={meLoading}
                    guest="Failed imports, registrations, updates and syncs"
                    user="Your failed imports, registrations, updates and syncs, and those of your services"
                    admin="All failed imports, registrations, updates and syncs"
                />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Select
                    value={operation ?? anyValue}
                    onValueChange={(val) =>
                        applyFilter({
                            operation:
                                val === anyValue
                                    ? undefined
                                    : (val as FailuresFilter["operation"]),
                        })
                    }
                    disabled={filtersDisabled}
                >
                    <SelectTrigger
                        aria-label="Filter by operation"
                        className="w-full sm:w-48"
                    >
                        <SelectValue placeholder="All operations" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={anyValue}>All operations</SelectItem>
                        {failedOperations.map((val) => (
                            <SelectItem key={val} value={val}>
                                {operationLabel(val)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={reason ?? anyValue}
                    onValueChange={(val) =>
                        applyFilter({
                            reason:
                                val === anyValue
                                    ? undefined
                                    : (val as FailuresFilter["reason"]),
                        })
                    }
                    disabled={filtersDisabled}
                >
                    <SelectTrigger
                        aria-label="Filter by reason"
                        className="w-full sm:w-64"
                    >
                        <SelectValue placeholder="All reasons" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={anyValue}>All reasons</SelectItem>
                        {failureReasons.map((val) => (
                            <SelectItem key={val} value={val}>
                                {failureReasonLabel(val)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <form
                    onSubmit={submitService}
                    className="flex w-full gap-2 sm:w-auto"
                >
                    <Input
                        aria-label="Filter by service ID"
                        placeholder="Service ID"
                        value={serviceInput}
                        maxLength={maxServiceIdLength}
                        onChange={(e) => setServiceInput(e.target.value)}
                        disabled={filtersDisabled}
                        className="sm:w-56"
                    />
                    <Button
                        type="submit"
                        variant="outline"
                        disabled={filtersDisabled}
                    >
                        Apply
                    </Button>
                </form>
                {filtered && (
                    <Button
                        variant="ghost"
                        onClick={() =>
                            applyFilter({
                                operation: undefined,
                                reason: undefined,
                                serviceId: undefined,
                            })
                        }
                    >
                        <XIcon />
                        Clear filters
                    </Button>
                )}
            </div>
            <div>{content}</div>
        </div>
    );
}

export default Page;
