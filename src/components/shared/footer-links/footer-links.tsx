import { footerLinks, isExternalLink } from "@/lib/footer-links";
import { cn } from "@/lib/utils";

type Props = { className?: string };

/**
 * The footer with the links of the deployment, e.g. to its privacy notice
 * and imprint (`NEXT_PUBLIC_FOOTER_LINKS`); nothing without links. Links
 * to other sites open in a new tab, so that unsaved changes stay
 */
function FooterLinks({ className }: Props) {
    const links = footerLinks();
    if (!links.length) return null;

    return (
        <footer
            className={cn(
                "shrink-0 px-4 py-2 text-xs text-muted-foreground",
                className,
            )}
        >
            <nav aria-label="Legal and contact">
                <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                    {links.map((link) => (
                        <li key={`${link.label} ${link.url}`}>
                            <a
                                href={link.url}
                                className="underline-offset-4 hover:text-foreground hover:underline"
                                {...(isExternalLink(link.url) && {
                                    target: "_blank",
                                    rel: "noopener noreferrer",
                                })}
                            >
                                {link.label}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>
        </footer>
    );
}

export default FooterLinks;
