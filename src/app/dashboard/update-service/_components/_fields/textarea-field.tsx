import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type TextareaFieldProps = {
  form: any;
  name: string;
  label: string;
  placeholder?: string;
  rows?: number;
  className?: string;
};

export function TextareaField({
  form,
  name,
  label,
  placeholder,
  rows = 5,
  className,
}: TextareaFieldProps) {
  return (
    <div className={className}>
      <form.Field name={name}>
        {(field: any) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid;

          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name}>{label}</FieldLabel>

              <Textarea
                id={field.name}
                name={field.name}
                value={field.state.value ?? ""}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                aria-invalid={isInvalid}
              />

              {isInvalid && (
                <FieldError errors={field.state.meta.errors} />
              )}
            </Field>
          );
        }}
      </form.Field>
    </div>
  );
}
