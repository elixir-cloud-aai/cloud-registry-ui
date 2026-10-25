/**
 * @description environments of services from
 * `NEXT_PUBLIC_SERVICE_ENVIRONMENTS`, set at build time
 */

// as the registry allows them (`custom.endpoints.services.environments`),
// comma-separated: unset or empty for the values that the GA4GH
// specification suggests, as the registry's default; `*` for any value, as
// an empty list in the registry
const configured = [
    ...new Set(
        (process.env.NEXT_PUBLIC_SERVICE_ENVIRONMENTS ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
    ),
];
const defaultEnvironments = ["prod", "test", "dev", "staging"];
const anyEnvironment = "*";
// as long as the API allows (`maxLength` of `environment`)
const maxEnvironmentLength = 256;

const serviceEnvironments =
    configured.length === 1 && configured[0] === anyEnvironment
        ? []
        : configured.length
          ? configured
          : defaultEnvironments;

// as the registry words it, with the form's label
const environmentMessage = `Environment must be one of: ${serviceEnvironments.map((value) => `'${value}'`).join(", ")}.`;

/**
 * Check whether the registry accepts an environment
 * @param value Environment, if any
 * @returns Whether it is empty or allowed
 */
function isAllowedEnvironment(value?: string) {
    return (
        !value ||
        !serviceEnvironments.length ||
        serviceEnvironments.includes(value)
    );
}

/**
 * Get the position of an environment in the setting
 * @param value Environment
 * @returns Its index, or the number of configured environments if not one
 */
function environmentRank(value: string) {
    const index = serviceEnvironments.indexOf(value);
    return index === -1 ? serviceEnvironments.length : index;
}

export {
    environmentMessage,
    environmentRank,
    isAllowedEnvironment,
    maxEnvironmentLength,
    serviceEnvironments,
};
