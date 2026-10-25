import { FieldGroup } from "@/components/ui/field";
import { serviceEnvironments } from "@/lib/service-environments";
import type { ServiceUpdationFormType } from "@/types/service-update-form";
import { SelectField, TextField } from "../_fields";

type Props = {
    form: ServiceUpdationFormType;
};

function ServiceEnvSection({ form }: Props) {
    return (
        <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <TextField
                form={form}
                name="version"
                label="Service Version"
                placeholder="1.0.0"
            />

            {serviceEnvironments.length ? (
                <SelectField
                    form={form}
                    name="environment"
                    label="Environment"
                    placeholder="Select environment"
                    emptyLabel="Not set"
                    options={serviceEnvironments.map((value) => ({
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
