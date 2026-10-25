import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import type { ServiceUpdationFormType } from "@/types/service-update-form";
import { ReadOnlyField, TextField } from "../_fields";

type Props = {
    form: ServiceUpdationFormType;
    updatedAt?: string;
};

function ServiceAdvancedSection({ form, updatedAt }: Props) {
    return (
        <FieldSet>
            <FieldLegend>Advanced Configuration</FieldLegend>
            <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <TextField
                    form={form}
                    name="createdAt"
                    label="Created At"
                    placeholder="RFC 3339, e.g. 2024-01-01T00:00:00Z"
                    description="Leave empty to keep the stored timestamp."
                />

                <ReadOnlyField
                    id="updatedAt"
                    label="Updated At"
                    value={updatedAt}
                    description="Set by the registry on every change."
                />
            </FieldGroup>
        </FieldSet>
    );
}

export default ServiceAdvancedSection;
