import { FieldGroup } from "@/components/ui/field";
import { ServiceUpdationFormType } from "@/types/service-update-form";
import { TextField } from "../_fields";

type Props = {
    form: ServiceUpdationFormType;
};

function ServiceBasicInfoSection({ form }: Props) {
    return (
        <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <TextField
                form={form}
                name="name"
                label="Service Name"
                placeholder="Enter a descriptive name for your service"
            />

            <TextField
                form={form}
                name="url"
                label="Service URL"
                placeholder="https://api.example.com/v1"
            />

            <TextField
                form={form}
                name="organization.name"
                label="Organization Name"
                placeholder="Enter your organization name"
            />

            <TextField
                form={form}
                name="organization.url"
                label="Organization URL"
                placeholder="https://example.com"
            />
        </FieldGroup>
    );
}

export default ServiceBasicInfoSection;
