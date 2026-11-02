import { Fragment } from "react";
import { safeHref } from "@/lib/links";
import { breakSegments } from "./break-helper";

/**
 * a long value, e.g. a URL or an ID, that may break after its slashes,
 * dots and similar delimiters, and mid-word only if a part doesn't fit
 */
function Breakable({ value }: { value: string }) {
    return breakSegments(value).map((segment, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the segments of a value keep their order
        <Fragment key={index}>
            {segment}
            <wbr />
        </Fragment>
    ));
}

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
    const href = isLink ? safeHref(value) : undefined;
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] font-medium tracking-widest uppercase text-muted-foreground">
                {label}
            </span>
            {href ? (
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline wrap-break-word"
                >
                    <Breakable value={value} />
                </a>
            ) : (
                <span
                    className={`text-sm text-foreground wrap-break-word ${mono ? "font-mono" : ""}`}
                >
                    <Breakable value={value} />
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
        <div className="min-w-0 border border-border rounded-lg overflow-hidden">
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

export { Breakable, Field, SectionCard };
