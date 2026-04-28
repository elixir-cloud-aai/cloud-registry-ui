function Field({
    label,
    value,
    mono = false,
    isLink = false,
}: {
    label: string;
    value?: string;
    mono?: boolean;
    isLink?: boolean;
}) {
    if (!value) return null;
    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground">
                {label}
            </span>
            {isLink ? (
                <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline break-all"
                >
                    {value}
                </a>
            ) : (
                <span className={`text-sm text-foreground break-all ${mono ? "font-mono" : ""}`}>
                    {value}
                </span>
            )}
        </div>
    );
}

function SectionCard({
    icon,
    title,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3.5 py-2 flex items-center gap-2 border-b border-border">
                {icon}
                <span className="text-[11px] font-medium tracking-widest uppercase text-muted-foreground">
                    {title}
                </span>
            </div>
            <div className="p-3.5">{children}</div>
        </div>
    );
}

export { Field, SectionCard };
