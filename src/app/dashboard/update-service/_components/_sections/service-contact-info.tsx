import { FieldGroup } from "@/components/ui/field";
import { ServiceUpdationFormType } from "@/types/service-update-form";
import { TextField } from "../_fields";

type Props = {
    form: ServiceUpdationFormType;
};

function ServiceContactInfoSection({ form }: Props) {
    return (
        <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <TextField
                form={form}
                name="contactUrl"
                label="Contact URL"
                placeholder="mailto:support@example.com or https://contact.example.com"
            />

            <TextField
                form={form}
                name="documentationUrl"
                label="Documentation URL"
                placeholder="https://docs.example.com"
            />
        </FieldGroup>
    );
}

export default ServiceContactInfoSection;
