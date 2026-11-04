/**
 * @description failed registrations in the create form, the component
 * `ECCClientElixirCloudRegistryServiceCreate` of cloud-components: the
 * registry's client for the form, which checks registrations before sending
 * them (`checkedProvider`), the error from the form's event
 * `ecc-service-create-failed`, and the toast for it
 */
import type { EccServiceCreateFailedEvent } from "@elixir-cloud/cloud-registry/events";
import type {
    CloudRegistryProvider,
    ExternalServiceRegister,
} from "@elixir-cloud/cloud-registry/providers";
import type { ExternalToast } from "sonner";
import {
    duplicateToast,
    isServicesLimit,
    serviceTypeConflict,
    withFieldLabels,
} from "./errors";
import { servicesLimitToast } from "./service-limits";
import {
    type ServiceSchemaRules,
    serviceFields,
    serviceSchema,
} from "./service-schema";

type CreateFailure = EccServiceCreateFailedEvent["detail"];

/**
 * Get a registry client that checks registrations before sending them, as
 * the registry does (`serviceSchema()`), since the create form only checks
 * that the required fields are filled in
 * @param provider The registry's client
 * @param rules Get the registry's rules at the time of sending, e.g. from
 * `useRegistrationRules()`; `unknownRegistrationRules` leave the checks of
 * the rules to the registry
 * @returns A client like `provider`, whose registrations
 * (`createService()`, `createServiceWithId()`) reject invalid ones unsent,
 * with the first problem as the error's message; the form then reports
 * them in `ecc-service-create-failed`
 */
function checkedProvider<
    P extends Pick<
        CloudRegistryProvider,
        "createService" | "createServiceWithId"
    >,
>(provider: P, rules: () => ServiceSchemaRules): P {
    const check = (
        service: ExternalServiceRegister,
        send: () => Promise<string>,
    ) => {
        const result = serviceSchema(rules()).safeParse(serviceFields(service));
        return result.success
            ? send()
            : Promise.reject(new Error(result.error.issues[0].message));
    };
    // the client's other methods and fields, through its prototype
    return Object.assign(Object.create(provider), {
        createService: (service: ExternalServiceRegister) =>
            check(service, () => provider.createService(service)),
        createServiceWithId: (id: string, service: ExternalServiceRegister) =>
            check(service, () => provider.createServiceWithId(id, service)),
    }) as P;
}

/**
 * Get a registry client for the create form, which reads the allowed
 * environments from `registration_rules` of the service info: the name up to
 * cloud-registry 1.0.0rc1, as cloud-components hasn't moved to
 * `registrationRules`. Drop this once it has
 * @param provider The registry's client
 * @returns A client like `provider`, whose service info has the rules under
 * the former name, and none there if it has none under the new one
 */
function withFormRules<P extends { getServiceInfo(): Promise<unknown> }>(
    provider: P,
): P {
    return Object.assign(Object.create(provider), {
        getServiceInfo: async () => {
            const info = (await provider.getServiceInfo()) as {
                registrationRules?: unknown;
            } | null;
            return { ...info, registration_rules: info?.registrationRules };
        },
    }) as P;
}

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

export { checkedProvider, createError, createFailedToast, withFormRules };
