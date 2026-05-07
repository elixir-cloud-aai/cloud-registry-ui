import { FieldGroup } from "@/components/ui/field";
import { ServiceUpdationFormType } from "@/types/service-update-form";
import { TextField } from "../_fields";

type Props = {
    form: ServiceUpdationFormType;
};

function ServiceTypeSection({ form }: Props) {
    return (
        <FieldGroup className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <TextField form={form} name="type.group" label="Type Group" placeholder="org.ga4gh" />

            <TextField
                form={form}
                name="type.artifact"
                label="Type Artifact"
                placeholder="beacon, wes, trs, etc."
            />

            <TextField form={form} name="type.version" label="Type Version" placeholder="1.0.0" />
        </FieldGroup>
    );
}

export default ServiceTypeSection;
