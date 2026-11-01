/**
 * @description the schema of a service's registration, built from the
 * registry's registration rules (`registration-rules.ts`), so that forms
 * check entries as the registry does: `serviceSchema(rules)` checks the
 * fields of a registration as forms hold them (strings; empty for unset
 * optional fields), and `serviceFields()` turns a service, or a
 * registration as the API takes it, into these fields. E.g., to check a
 * registration before sending it:
 *
 * ```ts
 * const { rules } = useRegistrationRules();
 * const result = serviceSchema(rules).safeParse(serviceFields(service));
 * if (!result.success) toast.error(result.error.issues[0].message);
 * ```
 *
 * Only the rules on the fields apply (`ServiceSchemaRules`: `environments`
 * and `urlSchemes`); a `RegistrationRules` object can be passed as it is.
 * `serviceFields()` takes any `ServiceInput`: an `ExternalService` or
 * `ExternalServiceRegister` of the registry's client, or a partial one.
 * Also here: `serviceTypeSchema` and `defaultTypeGroup`, for forms of
 * service types. The edit form extends the schema with its own fields
 * (`formDataSchema(rules)` and `serviceFormSchema(id, rules)` in
 * `services/update/_components/form-helper.ts`).
 */
import {
    environmentMessage,
    isAllowedEnvironment,
    maxEnvironmentLength,
    type RegistrationRules,
} from "@/lib/registration-rules";
import { z } from "@/lib/zod";

/** The rules that the schema follows */
type ServiceSchemaRules = Pick<
    RegistrationRules,
    "environments" | "urlSchemes"
>;

const httpUrl = z.url({ protocol: z.regexes.httpProtocol });
const contactUrl = z.url({ protocol: /^(https?|mailto)$/ });
const hasNoUserInfoOrSpaces = (value: string) =>
    !/\s|^https?:\/\/[^/?#]*@/i.test(value);

/**
 * Check the length of a string as the registry does
 * @param max Maximum length, in characters (code points, not UTF-16 code
 * units as `z.string().max()` counts them)
 * @returns The check; it counts the characters only where needed, as they
 * are between half the code units and all of them
 */
const atMost = (max: number) => (value: string) =>
    value.length <= max ||
    (value.length <= 2 * max && [...value].length <= max);

/** The group of new service types, unless another one is given */
const defaultTypeGroup = "org.ga4gh";

/** The schema of a service type, trimmed as the registry stores it */
const serviceTypeSchema = z.object({
    group: z
        .string()
        .trim()
        .min(1, "Type group is required.")
        .refine(atMost(256), "Type group must be at most 256 characters."),
    artifact: z
        .string()
        .trim()
        .min(1, "Type artifact is required.")
        .refine(atMost(256), "Type artifact must be at most 256 characters."),
    version: z
        .string()
        .trim()
        .min(1, "Type version is required.")
        .refine(atMost(256), "Type version must be at most 256 characters."),
});

/**
 * Get the schema of the URL of a service
 * @param schemes Allowed schemes, lowercase, not empty
 * @returns The schema
 */
function serviceUrlSchema(schemes: readonly string[]) {
    const example = schemes.includes("https") ? "https" : schemes[0];
    return z
        .string()
        .refine(atMost(2048), "Service URL must be at most 2048 characters.")
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
                schemes.includes(value.trim().split(":")[0].toLowerCase()),
            `Service URL must be an ${schemes.join(" or ")} URL, e.g. ${example}://example.org/.`,
        );
}

/**
 * Get the schema of the environment of a service
 * @param environments Allowed environments; empty for any
 * @returns The schema; empty values are allowed (unset)
 */
function environmentSchema(environments: readonly string[]) {
    return (
        z
            .string()
            // characters, not UTF-16 code units, as the registry counts them
            .refine(
                (value) => [...value].length <= maxEnvironmentLength,
                `Environment must be at most ${maxEnvironmentLength} characters.`,
            )
            // as the registry checks it, also for stored values
            .refine(
                (value) => isAllowedEnvironment(environments, value),
                // never shown without a list: any value is allowed then
                environments.length ? environmentMessage(environments) : "",
            )
    );
}

/**
 * Get the schema of a service's registration
 * @param rules The registry's rules, e.g. from `useRegistrationRules()`
 * @returns The schema of the fields that a registration sends, as forms
 * hold them: strings, empty for unset optional fields (see
 * `serviceFields()`)
 */
function serviceSchema(rules: ServiceSchemaRules) {
    return z.object({
        name: z
            .string()
            .min(1, "Service name is required.")
            .refine(
                atMost(1024),
                "Service name must be at most 1024 characters.",
            ),
        url: serviceUrlSchema(rules.urlSchemes),
        organization: z.object({
            name: z
                .string()
                .min(1, "Organization name is required.")
                .refine(
                    atMost(1024),
                    "Organization name must be at most 1024 characters.",
                ),
            url: z
                .string()
                .refine(
                    atMost(2048),
                    "Organization URL must be at most 2048 characters.",
                )
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
            .refine(
                atMost(256),
                "Service version must be at most 256 characters.",
            ),
        description: z
            .string()
            .refine(
                atMost(4096),
                "Description must be at most 4096 characters.",
            ),
        contactUrl: z
            .string()
            .refine(
                atMost(2048),
                "Contact URL must be at most 2048 characters.",
            )
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
            .refine(
                atMost(2048),
                "Documentation URL must be at most 2048 characters.",
            )
            .refine(
                (value) =>
                    value === "" ||
                    (httpUrl.safeParse(value).success &&
                        hasNoUserInfoOrSpaces(value)),
                "Documentation URL must be an http(s) URL, e.g. https://docs.example.org/.",
            ),
        environment: environmentSchema(rules.environments),
    });
}

/** The fields of a registration, as `serviceSchema()` checks them */
type ServiceFields = z.infer<ReturnType<typeof serviceSchema>>;

/** A service, or a registration as the API takes it, possibly partial */
type ServiceInput = Partial<
    Omit<ServiceFields, "organization" | "type"> & {
        organization: Partial<ServiceFields["organization"]>;
        type: Partial<ServiceFields["type"]>;
    }
>;

/**
 * Get the fields of a registration, as `serviceSchema()` checks them
 * @param service A service or registration, if any; other fields (e.g. its
 * ID) are left out
 * @returns The fields, empty where the service has none, and the type in
 * the default group (`defaultTypeGroup`) if it has none
 */
function serviceFields(service?: ServiceInput): ServiceFields {
    return {
        name: service?.name ?? "",
        url: service?.url ?? "",
        organization: {
            name: service?.organization?.name ?? "",
            url: service?.organization?.url ?? "",
        },
        type: {
            group: service?.type?.group ?? defaultTypeGroup,
            artifact: service?.type?.artifact ?? "",
            version: service?.type?.version ?? "",
        },
        version: service?.version ?? "",
        description: service?.description ?? "",
        contactUrl: service?.contactUrl ?? "",
        documentationUrl: service?.documentationUrl ?? "",
        environment: service?.environment ?? "",
    };
}

export {
    defaultTypeGroup,
    type ServiceFields,
    type ServiceInput,
    type ServiceSchemaRules,
    serviceFields,
    serviceSchema,
    serviceTypeSchema,
};
