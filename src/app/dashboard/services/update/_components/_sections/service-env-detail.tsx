import { FieldGroup } from "@/components/ui/field";
import type { ServiceUpdationFormType } from "@/types/service-update-form";
import { SelectField, TextField } from "../_fields";

type Props = {
    form: ServiceUpdationFormType;
    // as the registry allows them; empty for any value
    environments: readonly string[];
};

function ServiceEnvSection({ form, environments }: Props) {
    return (
        <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <TextField
                form={form}
                name="version"
                label="Service Version"
                placeholder="1.0.0"
            />

            {environments.length ? (
                <SelectField
                    form={form}
                    name="environment"
                    label="Environment"
                    placeholder="Select environment"
                    emptyLabel="Not set"
                    options={environments.map((value) => ({
                        label: value,
                        value,
                    }))}
                />
            ) : (
                <TextField
                    form={form}
                    name="environment"
                    label="Environment"
                    placeholder="prod"
                />
            )}
        </FieldGroup>
    );
}

export default ServiceEnvSection;
