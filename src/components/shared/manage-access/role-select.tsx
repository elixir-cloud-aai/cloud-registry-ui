import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { Role } from "@/lib/cloud-registry.types";
import { roleOptions } from "./access-helper";

type Props = {
    value: Role;
    onChange: (role: Role) => void;
    id?: string;
    label?: string;
    size?: "sm" | "default";
    className?: string;
    disabled?: boolean;
};

function RoleSelect({
    value,
    onChange,
    id,
    label,
    size = "default",
    className,
    disabled = false,
}: Props) {
    return (
        <Select
            value={value}
            onValueChange={(val) => onChange(val as Role)}
            disabled={disabled}
        >
            <SelectTrigger
                id={id}
                size={size}
                className={className}
                aria-label={label}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {roleOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export default RoleSelect;
