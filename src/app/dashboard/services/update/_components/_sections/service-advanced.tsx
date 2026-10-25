import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ServiceUpdationFormType } from "@/types/service-update-form";
import { TextField } from "../_fields";

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

                <Field>
                    <FieldLabel htmlFor="updatedAt">Updated At</FieldLabel>
                    <Input id="updatedAt" value={updatedAt ?? ""} readOnly />
                    <FieldDescription>
                        Set by the registry on every change.
                    </FieldDescription>
                </Field>
            </FieldGroup>
        </FieldSet>
    );
}

export default ServiceAdvancedSection;
