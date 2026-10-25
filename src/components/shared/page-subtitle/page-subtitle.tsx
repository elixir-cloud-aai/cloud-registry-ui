import type { Me } from "@/lib/cloud-registry.types";

type Props = {
    me: Me | null;
    loading?: boolean;
    guest: string;
    user?: string;
    admin: string;
};

function PageSubtitle({ me, loading, guest, user, admin }: Props) {
    if (loading) {
        // the longest text, so the page doesn't move once the role is known
        const texts = [guest, user ?? "", `ADMIN MODE: ${admin}`];
        const longest = texts.reduce((a, b) => (b.length > a.length ? b : a));
        return <p className="leading-7 mt-2 invisible">{longest}</p>;
    }

    if (me?.admin)
        return (
            <p className="leading-7 mt-2">
                <span className="font-semibold text-[#b93f31] dark:text-[salmon]">
                    ADMIN MODE:
                </span>{" "}
                {admin}
            </p>
        );

    return <p className="leading-7 mt-2">{me && user ? user : guest}</p>;
}

export default PageSubtitle;
