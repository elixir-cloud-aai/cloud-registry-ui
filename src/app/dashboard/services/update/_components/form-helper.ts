import type {
    ExternalService,
    ExternalServiceRegister,
} from "@elixir-cloud/cloud-registry/providers";
import { z } from "zod";

const httpUrl = z.url({ protocol: z.regexes.httpProtocol });
const serviceUrlSchemes = (
    process.env.NEXT_PUBLIC_SERVICE_URL_SCHEMES || "https"
)
    .split(",")
    .map((scheme) => scheme.trim().toLowerCase());
const contactUrl = z.url({ protocol: /^(https?|mailto)$/ });
const hasNoUserInfoOrSpaces = (value: string) =>
    !/\s|^https?:\/\/[^/?#]*@/i.test(value);

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
            `Service URL must be an ${serviceUrlSchemes.join(" or ")} URL, e.g. https://example.org/.`,
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
    type: z.object({
        group: z
            .string()
            .min(1, "Type group is required.")
            .max(256, "Type group must be at most 256 characters."),
        artifact: z
            .string()
            .min(1, "Type artifact is required.")
            .max(256, "Type artifact must be at most 256 characters."),
        version: z
            .string()
            .min(1, "Type version is required.")
            .max(256, "Type version must be at most 256 characters."),
    }),
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
});

export type FormData = z.infer<typeof formDataSchema>;

export function normalizeFormData(data?: Partial<FormData>): FormData {
    return {
        name: data?.name ?? "",
        url: data?.url ?? "",
        version: data?.version ?? "",
        description: data?.description ?? "",
        contactUrl: data?.contactUrl ?? "",
        documentationUrl: data?.documentationUrl ?? "",
        environment: data?.environment ?? "",
        organization: {
            name: data?.organization?.name ?? "",
            url: data?.organization?.url ?? "",
        },

        type: {
            group: data?.type?.group ?? "org.ga4gh",
            artifact: data?.type?.artifact ?? "",
            version: data?.type?.version ?? "",
        },
    };
}

export function normalizeServiceData(
    data: FormData,
    service?: Partial<ExternalService>,
): ExternalServiceRegister {
    return {
        ...data,
        url: data.url.trim(),
        description: data.description || undefined,
        contactUrl: data.contactUrl || undefined,
        documentationUrl: data.documentationUrl || undefined,
        environment: data.environment || undefined,
        createdAt: service?.createdAt,
        updatedAt: service?.updatedAt,
    };
}
