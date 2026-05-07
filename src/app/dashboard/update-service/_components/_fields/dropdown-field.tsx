import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type Option = {
    label: string;
    value: string;
};

type SelectFieldProps = {
    form: any;
    name: string;
    label: string;
    placeholder?: string;
    options: Option[];
};

export function SelectField({ form, name, label, placeholder, options }: SelectFieldProps) {
    return (
        <form.Field name={name}>
            {(field: any) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                return (
                    <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>

                        <Select
                            value={field.state.value}
                            onValueChange={(value) => field.handleChange(value)}
                        >
                            <SelectTrigger aria-invalid={isInvalid} id={field.name}>
                                <SelectValue placeholder={placeholder} />
                            </SelectTrigger>

                            <SelectContent>
                                {options.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                    </Field>
                );
            }}
        </form.Field>
    );
}
