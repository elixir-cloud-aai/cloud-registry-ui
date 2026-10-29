import Image from "next/image";
import { Button } from "@/components/ui/button";
import { returnPath } from "@/lib/login-flow";
import { loginProviderInfos } from "@/lib/login-providers";

export const dynamic = "force-dynamic";

async function Page({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const providers = loginProviderInfos();
    // the app's page to return to after the login, e.g. of an invitation
    const { next } = await searchParams;
    const nextPath = returnPath(typeof next === "string" ? next : undefined);
    const nextQuery = nextPath ? `&next=${encodeURIComponent(nextPath)}` : "";

    return (
        <div className="flex justify-center items-center h-screen">
            <div className="flex flex-col items-center space-y-4 w-full max-w-xs px-4">
                <p className="font-medium text-lg">Log in with</p>
                {providers.map((provider) => (
                    <Button
                        key={provider.id}
                        variant={"outline"}
                        className="w-full h-auto py-3 flex-col gap-2"
                        asChild
                    >
                        {/* a plain link: the route redirects to the provider,
                            which client-side navigation can't fetch */}
                        <a
                            href={`/auth/api/login-redirect?provider=${encodeURIComponent(provider.id)}${nextQuery}`}
                        >
                            <span className="relative h-10 w-full">
                                <Image
                                    src={provider.logo}
                                    className="object-contain"
                                    fill
                                    alt=""
                                    loading="eager"
                                    unoptimized
                                />
                            </span>
                            {provider.name}
                        </a>
                    </Button>
                ))}
            </div>
        </div>
    );
}

export default Page;
