/**
 * @description import of service info into the create form, the component
 * `ECCClientElixirCloudRegistryServiceCreate` of cloud-components, which has
 * no properties for values. Until it has, this module is the one place that
 * knows its internal state (`formData`, `typeChoice`, `serviceTypes`): the
 * form renders them and keeps them editable as if users had typed them, and
 * they tell whether users changed the values. The end-to-end tests
 * (`e2e/service-import.spec.ts`) fail if an update of the component changes
 * this state.
 */
import type { ExternalServiceRegister } from "@elixir-cloud/cloud-registry/providers";
import { errorMessage, mutationError, retryAfterText } from "./errors";
import { hasStatus } from "./permissions";
import { typeKey } from "./service-types";

/** The values of the create form that sync can change */
type ImportValues = Pick<
    ExternalServiceRegister,
    "name" | "url" | "type" | "organization" | "version"
> &
    Partial<
        Pick<
            ExternalServiceRegister,
            "description" | "contactUrl" | "documentationUrl" | "environment"
        >
    >;

/** The internal state of the create form */
type CreateFormState = {
    formData: ImportValues & Record<string, unknown>;
    typeChoice: string;
    serviceTypes: ImportValues["type"][];
};

// the form's value of `typeChoice` for a new type
const newTypeChoice = "new";

/**
 * Get the values to compare, whatever the form or the registry left empty
 * @param values Values of the form, or of the registry
 * @returns The values in a fixed order, with empty text for those not set
 */
function comparable(values: ImportValues) {
    const { name, url, type, organization, version } = values;
    return JSON.stringify([
        name,
        url,
        typeKey(type),
        organization.name,
        organization.url,
        version,
        values.description ?? "",
        values.contactUrl ?? "",
        values.documentationUrl ?? "",
        values.environment ?? "",
    ]);
}

/**
 * Check whether values are those of an import, i.e. what sync would write
 * @param values Values of the form, or those it sends
 * @param imported Values of the import
 * @returns Whether they are the same; values of the form that sync doesn't
 * write (e.g. a custom ID) don't count
 */
function sameValues(values: ImportValues, imported: ImportValues) {
    return comparable(values) === comparable(imported);
}

/**
 * Check whether to sync a service that the form sends
 * @param service Values that it sends
 * @param choice `values`: those of the import, if any; `wanted`: whether the
 * registry syncs, and users left the box ticked
 * @returns Whether to sync: only values that sync would write itself, so that
 * it overrides no manual changes
 */
function syncWanted(
    service: ImportValues,
    { values, wanted }: { values?: ImportValues; wanted: boolean },
) {
    return wanted && !!values && sameValues(service, values);
}

/**
 * Get the state of the create form
 * @param form The form's element, if mounted
 * @returns Its state, if it has the expected one
 */
function formState(form: unknown) {
    const state = form as Partial<CreateFormState> | null | undefined;
    return state?.formData?.organization &&
        state.formData.type &&
        typeof state.typeChoice === "string" &&
        Array.isArray(state.serviceTypes)
        ? (state as CreateFormState)
        : undefined;
}

/**
 * Get the values in the create form
 * @param form The form's element, if mounted
 * @returns The values, if it has the expected state
 */
function createFormValues(form: unknown): ImportValues | undefined {
    return formState(form)?.formData;
}

/**
 * Fill in the create form, keeping values that an import doesn't have (e.g. a
 * custom ID); a value that the import leaves out is emptied
 * @param form The form's element, if mounted
 * @param values Values of the import
 * @param allowNewType Whether the form offers new service types
 * @returns `filled`: whether the form could be filled in; `typeOffered`:
 * whether it took the service type (registered, or a new one); otherwise,
 * users have to choose another one
 */
function fillCreateForm(
    form: unknown,
    values: ImportValues,
    allowNewType: boolean,
) {
    const state = formState(form);
    if (!state) return { filled: false, typeOffered: false };
    const key = typeKey(values.type);
    const listed = state.serviceTypes.some((val) => typeKey(val) === key);
    const typeOffered = listed || allowNewType;
    const { group, artifact, version } = values.type;
    state.typeChoice = listed ? key : allowNewType ? newTypeChoice : "";
    state.formData = {
        ...state.formData,
        name: values.name,
        url: values.url,
        organization: {
            name: values.organization.name,
            url: values.organization.url,
        },
        type: typeOffered
            ? { group, artifact, version }
            : { ...state.formData.type, artifact: "", version: "" },
        version: values.version,
        description: values.description ?? "",
        contactUrl: values.contactUrl ?? "",
        documentationUrl: values.documentationUrl ?? "",
        environment: values.environment ?? "",
    };
    return { filled: true, typeOffered };
}

/**
 * Take what users entered in the form, to tell later if they changed it
 * @param form The form element
 * @returns Its values, to compare
 */
function formSnapshot(form: unknown) {
    return JSON.stringify(formState(form)?.formData);
}

/**
 * Get the message for a failed import
 * @param err Error of the request
 * @returns The message: the same for all problems of fetching, as the registry
 * doesn't tell them apart
 */
function importError(err: unknown) {
    if (hasStatus(err, 502))
        return "The registry could not fetch this service info. Check the address; only publicly available service info can be imported, as no tokens are sent.";
    if (hasStatus(err, 429))
        return `You have imported service info too often, or the registry is busy. ${retryAfterText(err)} Or fill in the form yourself.`;
    if (hasStatus(err, 400))
        return errorMessage(
            err,
            "This address or its service info can't be imported.",
        );
    return mutationError(
        err,
        "Cannot import service info currently.",
        "You don't have permission to import service info.",
    );
}

export {
    createFormValues,
    fillCreateForm,
    formSnapshot,
    type ImportValues,
    importError,
    sameValues,
    syncWanted,
};
