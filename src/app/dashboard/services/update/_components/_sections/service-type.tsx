import { PlusIcon } from "lucide-react";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { ServiceType } from "@/lib/cloud-registry.types";
import { typeKey } from "@/lib/service-types";
import type { ServiceUpdationFormType } from "@/types/service-update-form";
import { TextField } from "../_fields";
import {
    type FieldMetas,
    type FormData,
    newTypeChoice,
    typeErrors,
    typeOfChoice,
    typeOptions,
} from "../form-helper";

type Props = {
    form: ServiceUpdationFormType;
    // the registered types, as `GET /services/types` lists them; null if
    // they couldn't be loaded
    serviceTypes: readonly ServiceType[] | null;
    // the service's stored type, which stays a choice also if it isn't
    // listed (e.g. pending)
    current: ServiceType;
    // whether to offer "Add new service type"
    allowNewType: boolean;
};

// the parts of the form's state that the section reads
type FormState = {
    values: FormData;
    fieldMeta: FieldMetas<{ message?: string } | undefined>;
};

// the type, how it is chosen, and the errors on its fields (e.g. from the
// registry), shown on the list while the fields are hidden
const typeState = (state: FormState) => ({
    newType: state.values.newType,
    type: state.values.type,
    errors: typeErrors(state.fieldMeta),
});

// the type is chosen from the registered ones, as in the create form; a
// new one is entered in its fields, if the user may add types
function ServiceTypeSection({
    form,
    serviceTypes,
    current,
    allowNewType,
}: Props) {
    const options = typeOptions(serviceTypes ?? [], current);

    const choose = (choice: string) => {
        const { newType, type } = typeOfChoice(choice);
        form.setFieldValue("newType", newType);
        form.setFieldValue("type", type);
    };

    return (
        <div className="space-y-4">
            <form.Subscribe selector={typeState}>
                {({ newType, type, errors }: ReturnType<typeof typeState>) => {
                    const isInvalid = !newType && errors.length > 0;
                    return (
                        <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor="service-type">
                                Service Type
                            </FieldLabel>
                            <Select
                                value={newType ? newTypeChoice : typeKey(type)}
                                onValueChange={choose}
                            >
                                <SelectTrigger
                                    id="service-type"
                                    aria-invalid={isInvalid}
                                >
                                    <SelectValue placeholder="Select a service type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {allowNewType && (
                                        // first and set apart, so that long
                                        // lists don't hide it
                                        <>
                                            <SelectItem value={newTypeChoice}>
                                                <PlusIcon />
                                                Add new service type
                                            </SelectItem>
                                            <SelectSeparator />
                                        </>
                                    )}
                                    {options.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {serviceTypes === null && (
                                <p className="text-sm text-destructive">
                                    Could not load the registered service types.
                                </p>
                            )}
                            {isInvalid && <FieldError errors={errors} />}
                        </Field>
                    );
                }}
            </form.Subscribe>

            <form.Subscribe
                selector={(state: FormState) => state.values.newType}
            >
                {(newType: boolean) =>
                    newType && (
                        <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                            <TextField
                                form={form}
                                name="type.group"
                                label="Type Group"
                                placeholder="org.ga4gh"
                            />

                            <TextField
                                form={form}
                                name="type.artifact"
                                label="Type Artifact"
                                placeholder="beacon, wes, trs, etc."
                            />

                            <TextField
                                form={form}
                                name="type.version"
                                label="Type Version"
                                placeholder="1.0.0"
                            />
                        </FieldGroup>
                    )
                }
            </form.Subscribe>
        </div>
    );
}

export default ServiceTypeSection;
