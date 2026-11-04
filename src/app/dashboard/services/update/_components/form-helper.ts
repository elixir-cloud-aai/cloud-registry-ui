import type { ExternalServiceRegister } from "@elixir-cloud/cloud-registry/providers";
import type { DeepKeys } from "@tanstack/react-form";
import type { ServiceType } from "@/lib/cloud-registry.types";
import { serviceIdError } from "@/lib/service-ids";
import {
    defaultTypeGroup,
    type ServiceSchemaRules,
    serviceFields,
    serviceSchema,
} from "@/lib/service-schema";
import {
    compareTypes,
    typeFromKey,
    typeKey,
    typeLabel,
} from "@/lib/service-types";
import { z } from "@/lib/zod";

// as the registry checks timestamps (`is_date_time()` of cloud-registry)
const dateTime =
    /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/;
const isDateTime = (value: string) => {
    const match = dateTime.exec(value);
    if (!match) return false;
    const [year, month, day, hour, minute, second, offsetHour, offsetMinute] =
        match.slice(1).map((part) => Number(part ?? 0));
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return (
        year >= 1 &&
        month >= 1 &&
        month <= 12 &&
        day >= 1 &&
        day <= days[month - 1] &&
        hour < 24 &&
        minute < 60 &&
        second <= 60 &&
        offsetHour < 24 &&
        offsetMinute < 60
    );
};
const timestamp = (label: string) =>
    z
        .string()
        .refine(
            (value) => value === "" || isDateTime(value),
            `${label} must be an RFC 3339 date-time, e.g. 2024-01-01T00:00:00Z.`,
        );

/**
 * Get the schema of the fields of the edit form
 * @param rules The registry's rules, e.g. from `useRegistrationRules()`
 * @returns The schema of a service's registration (`serviceSchema()`),
 * with the stored ID (see `serviceFormSchema()` for new ones), the
 * creation time, and whether the type is a new one (`newType`: entered in
 * its fields, else chosen from a list; not sent)
 */
export function formDataSchema(rules: ServiceSchemaRules) {
    return serviceSchema(rules).extend({
        id: z.string(),
        createdAt: timestamp("Created At"),
        newType: z.boolean(),
    });
}

export type FormData = z.infer<ReturnType<typeof formDataSchema>>;

/**
 * Get the schema of the edit form of a service
 * @param initialId Current ID of the service, which stays valid
 * @param rules The registry's rules, e.g. from `useRegistrationRules()`
 * @param servicesPath Path of the services on the registry's server, for
 * the length of new IDs
 * @returns The schema, which checks new IDs as the registry does
 */
export function serviceFormSchema(
    initialId: string,
    rules: ServiceSchemaRules,
    servicesPath?: string,
) {
    return formDataSchema(rules).extend({
        id: z.string().superRefine((value, ctx) => {
            if (value === initialId) return;
            const message = serviceIdError(value, servicesPath);
            if (message) ctx.addIssue({ code: "custom", message });
        }),
    });
}

export const formFields = [
    "id",
    "name",
    "url",
    "organization.name",
    "organization.url",
    "type.group",
    "type.artifact",
    "type.version",
    "version",
    "environment",
    "description",
    "contactUrl",
    "documentationUrl",
    "createdAt",
] as const satisfies readonly DeepKeys<FormData>[];

// timestamps only for admins
export function normalizeFormData(
    data?: Partial<FormData>,
    admin = false,
): FormData {
    return {
        ...serviceFields(data),
        id: data?.id ?? "",
        createdAt: admin ? (data?.createdAt ?? "") : "",
        // the stored type is one of the choices
        newType: false,
    };
}

// the registry keeps the creation time that admins send, so it is sent
// only if changed; it always sets the update time of existing services; the
// ID is in the path, and changed by a rename
export function normalizeServiceData(
    { id: _id, createdAt, newType: _newType, ...data }: FormData,
    initial?: FormData,
): ExternalServiceRegister {
    return {
        ...data,
        url: data.url.trim(),
        // as validated by `serviceTypeSchema` (`@/lib/service-schema`)
        type: {
            group: data.type.group.trim(),
            artifact: data.type.artifact.trim(),
            version: data.type.version.trim(),
        },
        description: data.description || undefined,
        contactUrl: data.contactUrl || undefined,
        documentationUrl: data.documentationUrl || undefined,
        environment: data.environment || undefined,
        ...(initial &&
            createdAt &&
            createdAt !== initial.createdAt && { createdAt }),
    };
}

// whether the form changes more than the ID, and so needs an update
export function hasServiceChanges(value: FormData, initial: FormData) {
    return (
        JSON.stringify(normalizeServiceData(value, initial)) !==
        JSON.stringify(normalizeServiceData(initial, initial))
    );
}

/** The choice of a new service type in the list of types */
export const newTypeChoice = "new";

/**
 * Get the service types to choose from
 * @param serviceTypes The registered types, e.g. from `GET /services/types`
 * @param current The service's stored type, which stays a choice also if it
 * isn't listed (e.g. pending)
 * @returns Options of the types (values: `typeKey()`), sorted as the
 * registry sorts them, without duplicates
 */
export function typeOptions(
    serviceTypes: readonly ServiceType[],
    current: ServiceType,
) {
    const types = new Map(
        [...serviceTypes, current].map((type) => [typeKey(type), type]),
    );
    return [...types.values()]
        .sort(compareTypes)
        .map((type) => ({ label: typeLabel(type), value: typeKey(type) }));
}

/**
 * Get the type that a choice in the list of types sets
 * @param choice `newTypeChoice`, or the key (`typeKey()`) of a type
 * @returns The type, empty in the default group for a new one, and whether
 * it is new
 */
export function typeOfChoice(choice: string) {
    if (choice === newTypeChoice)
        return {
            newType: true,
            type: { group: defaultTypeGroup, artifact: "", version: "" },
        };
    return { newType: false, type: typeFromKey(choice) };
}

/**
 * Check whether the edit form offers new service types
 * @param options `mayAdd`: whether the user may add types
 * (`mayAddServiceTypes` of `GET /me`); `pending`: whether the service
 * is pending, undefined if unknown; `admin`: whether the user acts as admin
 * @returns Whether to offer them: pending services take only approved
 * types from users other than admins, so these users get them only for
 * services known not to be pending
 */
export function offersNewType({
    mayAdd,
    pending,
    admin = false,
}: {
    mayAdd: boolean;
    pending?: boolean;
    admin?: boolean;
}) {
    return mayAdd && (admin || pending === false);
}

/**
 * Get the approved service types
 * @param serviceTypes Types from `GET /services/types`, which lists the
 * user's pending ones too if the registry requires login for reads (the
 * request is then sent with the token)
 * @param pending The pending types that the user may see (`GET
 * /approvals`)
 * @returns The listed types that aren't pending
 */
export function approvedTypes(
    serviceTypes: readonly ServiceType[],
    pending: readonly ServiceType[],
) {
    const keys = new Set(pending.map(typeKey));
    return serviceTypes.filter((type) => !keys.has(typeKey(type)));
}

/** The fields of a service type in the form */
const typeFields = ["type.group", "type.artifact", "type.version"] as const;

/** The meta data of the form's fields, as far as `typeErrors()` reads it */
export type FieldMetas<E> = Partial<
    Record<string, { isTouched: boolean; errors: E[] }>
>;

/**
 * Get the errors on the fields of the service type, e.g. from the
 * registry, to show them while the fields are hidden
 * @param fieldMeta The meta data of the form's fields
 * @returns The errors of the touched fields of the type
 */
export function typeErrors<E>(fieldMeta: FieldMetas<E>) {
    return typeFields.flatMap((name) => {
        const meta = fieldMeta[name];
        return meta?.isTouched ? meta.errors : [];
    });
}
