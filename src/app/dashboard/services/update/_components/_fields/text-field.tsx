import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { TextFieldForm, TextFieldName } from "@/types/service-update-form";

type TextFieldProps<T> = {
    form: TextFieldForm<T>;
    name: TextFieldName<T>;
    label: string;
    placeholder?: string;
    description?: string;
};

export function TextField<T>({
    form,
    name,
    label,
    placeholder,
    description,
}: TextFieldProps<T>) {
    return (
        <form.Field name={name}>
            {(field) => {
                const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;

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

                        {description && (
                            <FieldDescription>{description}</FieldDescription>
                        )}

                        {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                        )}
                    </Field>
                );
            }}
        </form.Field>
    );
}
