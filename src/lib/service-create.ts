/**
 * @description failed registrations in the create form, the component
 * `ECCClientElixirCloudRegistryServiceCreate` of cloud-components: the
 * error from its event `ecc-service-create-failed`, and the toast for it
 */
import type { EccServiceCreateFailedEvent } from "@elixir-cloud/cloud-registry/events";
import type { ExternalToast } from "sonner";
import {
    duplicateToast,
    isServicesLimit,
    serviceTypeConflict,
    withFieldLabels,
} from "./errors";
import { servicesLimitToast } from "./service-limits";

type CreateFailure = EccServiceCreateFailedEvent["detail"];

/**
 * Get the error of a failed registration
 * @param detail Detail of the event `ecc-service-create-failed`
 * @returns The provider's error (`cause`), with all its fields (e.g. the
 * registry's `code`); else an error with the event's status, detail and
 * service ID, and the `code` of the cause, e.g. of a provider that throws no
 * `Error`
 */
function createError({
    error,
    status,
    detail,
    serviceId,
    cause,
}: CreateFailure) {
    if (cause instanceof Error) return cause;
    const err = new Error(error);
    if (status !== undefined) Object.assign(err, { status });
    // the registry's code, from causes that aren't errors, e.g. plain objects
    const code =
        cause !== null &&
        typeof cause === "object" &&
        "code" in cause &&
        typeof cause.code === "string"
            ? cause.code
            : undefined;
    if (code !== undefined) Object.assign(err, { code });
    return Object.assign(err, { detail, serviceId });
}

/**
 * Get the toast for a failed registration
 * @param failure Detail of the event `ecc-service-create-failed`
 * @param options `limit`: the registry's limit of services per user, if
 * already read; `readLimit`: reads it now otherwise; `adminAvailable`:
 * whether the user may switch to admin mode
 * @returns The toast: the duplicate with a link to it, the limit of
 * services, the limit of unused service types, else the error with the
 * form's labels
 */
async function createFailedToast(
    failure: CreateFailure,
    options: {
        limit: number | undefined;
        readLimit: () => Promise<number | undefined>;
        adminAvailable: boolean;
    },
): Promise<ExternalToast & { message: string }> {
    const err = createError(failure);

    const duplicate = duplicateToast(err);
    if (duplicate) return duplicate;

    // with the limit that the registry publishes, else its detail
    if (isServicesLimit(err))
        return {
            message: await servicesLimitToast(
                options.limit,
                options.readLimit,
                failure.error,
                options.adminAvailable,
            ),
            duration: 10000,
        };

    return {
        message: serviceTypeConflict(err) ?? withFieldLabels(failure.error),
    };
}

export { createError, createFailedToast };
