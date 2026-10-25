import { FieldGroup } from "@/components/ui/field";
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

            <SelectField
                form={form}
                name="environment"
                label="Environment"
                placeholder="Select environment"
                options={[
                    { label: "Production", value: "prod" },
                    { label: "Staging", value: "staging" },
                    { label: "Development", value: "dev" },
                    { label: "Test", value: "test" },
                ]}
            />
        </FieldGroup>
    );
}

export default ServiceEnvSection;
