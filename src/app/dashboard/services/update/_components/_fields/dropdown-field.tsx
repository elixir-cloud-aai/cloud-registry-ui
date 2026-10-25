import { getBy } from "@tanstack/react-form";
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
    // label of an option for no value (`""`)
    emptyLabel?: string;
};

// select items can't have an empty value; no option can be a comma, as
// options come from comma-separated settings
const emptyValue = ",";

export function SelectField({
    form,
    name,
    label,
    placeholder,
    options,
    emptyLabel,
}: SelectFieldProps) {
    return (
        <form.Field name={name}>
            {(field: any) => {
                const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid;
                const value: string = field.state.value;
                const stored: string =
                    getBy(form.options.defaultValues, name) ?? "";
                // stored values outside the options are still shown, and
                // can be picked again
                const others = [...new Set([stored, value])].filter(
                    (val) =>
                        val &&
                        val !== emptyValue &&
                        !options.some((o) => o.value === val),
                );
                const items = [
                    ...(emptyLabel === undefined
                        ? []
                        : [{ label: emptyLabel, value: emptyValue }]),
                    ...options,
                    ...others.map((val) => ({ label: val, value: val })),
                ];

                return (
                    <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>

                        <Select
                            value={
                                value === "" && emptyLabel !== undefined
                                    ? emptyValue
                                    : value
                            }
                            onValueChange={(val) =>
                                field.handleChange(
                                    val === emptyValue ? "" : val,
                                )
                            }
                        >
                            <SelectTrigger
                                aria-invalid={isInvalid}
                                id={field.name}
                            >
                                <SelectValue placeholder={placeholder} />
                            </SelectTrigger>

                            <SelectContent>
                                {items.map((option) => (
                                    <SelectItem
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {isInvalid && (
                            <FieldError errors={field.state.meta.errors} />
                        )}
                    </Field>
                );
            }}
        </form.Field>
    );
}
