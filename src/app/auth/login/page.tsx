import Image from "next/image";
import { Button } from "@/components/ui/button";
import { loginProviderInfos } from "@/lib/login-providers";

export const dynamic = "force-dynamic";

function Page() {
    const providers = loginProviderInfos();

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
                            href={`/auth/api/login-redirect?provider=${provider.id}`}
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
