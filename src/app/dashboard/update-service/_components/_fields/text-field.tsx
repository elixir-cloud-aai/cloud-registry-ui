import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type TextFieldProps = {
    form: any;
    name: string;
    label: string;
    placeholder?: string;
};

export function TextField({ form, name, label, placeholder }: TextFieldProps) {
    return (
        <form.Field name={name}>
            {(field: any) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                return (
                    <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>

                        <Input
                            id={field.name}
                            name={field.name}
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            placeholder={placeholder}
                            aria-invalid={isInvalid}
                        />

                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                );
            }}
        </form.Field>
    );
}
