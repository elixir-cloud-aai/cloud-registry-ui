import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type ReadOnlyFieldProps = {
    id: string;
    label: string;
    value?: string;
    description?: string;
};

export function ReadOnlyField({
    id,
    label,
    value,
    description,
}: ReadOnlyFieldProps) {
    return (
        <Field>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input id={id} value={value ?? ""} readOnly />
            {description && <FieldDescription>{description}</FieldDescription>}
        </Field>
    );
}
