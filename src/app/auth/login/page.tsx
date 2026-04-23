"use client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { redirect } from "next/navigation";
import { toast } from "sonner";
import { generateLoginRedirectLink } from "../_server";

function Page() {
    return (
        <div className="flex justify-center items-center h-screen">
            <Button
                className="cursor-pointer"
                size={"icon-lg"}
                onClick={async () => {
                    toast.loading("Redirecting to LS Login...");
                    const redirectUrl = await generateLoginRedirectLink();
                    redirect(redirectUrl);
                }}
            >
                <Image
                    src={"/ls-login-grey-wide.jpg"}
                    className={"max-w-80 h-auto"}
                    width={320}
                    height={71}
                    alt="ls-login-image"
                    loading="eager"
                />
            </Button>
        </div>
    );
}

export default Page;
