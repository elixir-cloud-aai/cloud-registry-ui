import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
    logo: { light: string; dark?: string };
    alt: string;
    className?: string;
    backingClassName?: string;
    imageClassName?: string;
    width: number;
    height: number;
};

function AppSidebarLogo({
    logo,
    alt,
    className,
    backingClassName,
    imageClassName,
    width,
    height,
}: Props) {
    const image = (src: string, scheme?: string) => (
        <Image
            src={src}
            width={width}
            height={height}
            sizes="50vw"
            alt={alt}
            className={cn(imageClassName, scheme)}
            unoptimized
        />
    );

    // without a dark variant, the logo gets a white backing in the dark scheme
    return (
        <div
            className={cn(
                className,
                !logo.dark && ["dark:bg-white", backingClassName],
            )}
        >
            {logo.dark ? (
                <>
                    {image(logo.light, "dark:hidden")}
                    {image(logo.dark, "hidden dark:block")}
                </>
            ) : (
                image(logo.light)
            )}
        </div>
    );
}

export default AppSidebarLogo;
