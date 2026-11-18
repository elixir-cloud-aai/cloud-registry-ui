import Link from "next/link";
import { FooterLinks } from "@/components/shared/footer-links";

/** The page for unknown paths: Next's text, with the footer's links */
function NotFound() {
    return (
        <div className="flex flex-col w-full h-screen">
            <div className="flex flex-1 justify-center items-center">
                <div className="flex flex-col items-center space-y-2">
                    <p className="font-medium text-lg">
                        This page could not be found.
                    </p>
                    <Link
                        href="/dashboard/services"
                        className="font-bold underline underline-offset-8"
                    >
                        Go to the services
                    </Link>
                </div>
            </div>
            <FooterLinks />
        </div>
    );
}

export default NotFound;
