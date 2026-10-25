import type { ExternalServiceRegister } from "@elixir-cloud/cloud-registry/providers";
import type { DeepKeys } from "@tanstack/react-form";
import { z } from "zod";

const httpUrl = z.url({ protocol: z.regexes.httpProtocol });
const configuredSchemes = (process.env.NEXT_PUBLIC_SERVICE_URL_SCHEMES ?? "")
    .split(",")
    .map((scheme) => scheme.trim().toLowerCase())
    .filter(Boolean);
const serviceUrlSchemes = configuredSchemes.length
    ? configuredSchemes
    : ["https"];
const contactUrl = z.url({ protocol: /^(https?|mailto)$/ });
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
const hasNoUserInfoOrSpaces = (value: string) =>
    !/\s|^https?:\/\/[^/?#]*@/i.test(value);

export const defaultTypeGroup = "org.ga4gh";

export const serviceTypeSchema = z.object({
    group: z
        .string()
        .trim()
        .min(1, "Type group is required.")
        .max(256, "Type group must be at most 256 characters."),
    artifact: z
        .string()
        .trim()
        .min(1, "Type artifact is required.")
        .max(256, "Type artifact must be at most 256 characters."),
    version: z
        .string()
        .trim()
        .min(1, "Type version is required.")
        .max(256, "Type version must be at most 256 characters."),
});

export const formDataSchema = z.object({
    name: z
        .string()
        .min(1, "Service name is required.")
        .max(1024, "Service name must be at most 1024 characters."),
    url: z
        .string()
        .max(2048, "Service URL must be at most 2048 characters.")
        .refine(
            (value) =>
                httpUrl.safeParse(value).success &&
                hasNoUserInfoOrSpaces(value.trim()),
            {
                message:
                    "Service URL must be a valid URL, e.g. https://example.org/.",
                abort: true,
            },
        )
        .refine(
            (value) =>
                serviceUrlSchemes.includes(
                    value.trim().split(":")[0].toLowerCase(),
                ),
            `Service URL must be an ${serviceUrlSchemes.join(" or ")} URL, e.g. ${serviceUrlSchemes[0]}://example.org/.`,
        ),
    organization: z.object({
        name: z
            .string()
            .min(1, "Organization name is required.")
            .max(1024, "Organization name must be at most 1024 characters."),
        url: z
            .string()
            .max(2048, "Organization URL must be at most 2048 characters.")
            .refine(
                (value) =>
                    httpUrl.safeParse(value).success &&
                    hasNoUserInfoOrSpaces(value),
                "Organization URL must be an http(s) URL, e.g. https://example.org/.",
            ),
    }),
    type: serviceTypeSchema,
    version: z
        .string()
        .min(1, "Service version is required.")
        .max(256, "Service version must be at most 256 characters."),
    description: z
        .string()
        .max(4096, "Description must be at most 4096 characters."),
    contactUrl: z
        .string()
        .max(2048, "Contact URL must be at most 2048 characters.")
        .refine((value) => !z.email().safeParse(value).success, {
            message:
                "Contact URL needs mailto: for email addresses, e.g. mailto:support@example.org.",
            abort: true,
        })
        .refine(
            (value) =>
                value === "" ||
                (contactUrl.safeParse(value).success &&
                    hasNoUserInfoOrSpaces(value)),
            "Contact URL must be an http(s) or mailto: URL, e.g. mailto:support@example.org.",
        ),
    documentationUrl: z
        .string()
        .max(2048, "Documentation URL must be at most 2048 characters.")
        .refine(
            (value) =>
                value === "" ||
                (httpUrl.safeParse(value).success &&
                    hasNoUserInfoOrSpaces(value)),
            "Documentation URL must be an http(s) URL, e.g. https://docs.example.org/.",
        ),
    environment: z
        .string()
        .max(256, "Environment must be at most 256 characters."),
    createdAt: timestamp("Created At"),
});

export type FormData = z.infer<typeof formDataSchema>;

export const formFields = [
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
        name: data?.name ?? "",
        url: data?.url ?? "",
        version: data?.version ?? "",
        description: data?.description ?? "",
        contactUrl: data?.contactUrl ?? "",
        documentationUrl: data?.documentationUrl ?? "",
        environment: data?.environment ?? "",
        createdAt: admin ? (data?.createdAt ?? "") : "",
        organization: {
            name: data?.organization?.name ?? "",
            url: data?.organization?.url ?? "",
        },

        type: {
            group: data?.type?.group ?? defaultTypeGroup,
            artifact: data?.type?.artifact ?? "",
            version: data?.type?.version ?? "",
        },
    };
}

// the registry keeps the creation time that admins send, so it is sent
// only if changed; it always sets the update time of existing services
export function normalizeServiceData(
    { createdAt, ...data }: FormData,
    initial?: FormData,
): ExternalServiceRegister {
    return {
        ...data,
        url: data.url.trim(),
        description: data.description || undefined,
        contactUrl: data.contactUrl || undefined,
        documentationUrl: data.documentationUrl || undefined,
        environment: data.environment || undefined,
        ...(initial &&
            createdAt &&
            createdAt !== initial.createdAt && { createdAt }),
    };
}
