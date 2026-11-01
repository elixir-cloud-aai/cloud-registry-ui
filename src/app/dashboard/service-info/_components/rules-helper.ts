import type { RegistrationRules } from "@/lib/registration-rules";
import { noUnusedTypes } from "@/lib/service-types";

/** A rule of the registry, as the service info page shows it */
type RuleRow = { label: string; value: string };

/**
 * Describe a limit of users other than admins
 * @param limit The limit; undefined without one
 * @param none What a limit of 0 means
 * @returns The limit, "No limit", or what 0 means
 */
function limitText(limit: number | undefined, none: string) {
    if (limit === undefined) return "No limit";
    return limit === 0 ? none : String(limit);
}

/**
 * Describe who may add service types
 * @param rules The registry's rules
 * @returns Who may add types: admins only also in modes `open` and
 * `moderated` if users may have no unused types, as the registry then
 * refuses every new type of theirs, also of services
 */
function typesText(
    rules: Pick<RegistrationRules, "serviceTypes" | "maxUnusedServiceTypes">,
) {
    const { serviceTypes } = rules;
    if (serviceTypes === "controlled" || noUnusedTypes(rules))
        return "Admins only";
    if (serviceTypes === "moderated")
        return "Logged-in users; types of users other than admins are pending until an admin approves them";
    if (serviceTypes === "open") return "Logged-in users";
    return "Not published";
}

/**
 * Get the rows of the registry's rules for registrations
 * @param rules The rules, from the service info (`registrationRules()`)
 * @returns Label and value of each rule, in the order of the registry's
 * docs
 */
function registrationRuleRows(rules: RegistrationRules): RuleRow[] {
    return [
        {
            label: "Environments",
            value: rules.environments.length
                ? rules.environments.join(", ")
                : "Any",
        },
        { label: "URL schemes", value: rules.urlSchemes.join(", ") },
        { label: "Who may add service types", value: typesText(rules) },
        {
            label: "Unused service types per user",
            value: limitText(
                rules.maxUnusedServiceTypes,
                "None: only admins add service types",
            ),
        },
        {
            label: "Services per user",
            value: limitText(
                rules.maxServicesPerUser,
                "None: only admins register services",
            ),
        },
    ];
}

export { type RuleRow, registrationRuleRows };
