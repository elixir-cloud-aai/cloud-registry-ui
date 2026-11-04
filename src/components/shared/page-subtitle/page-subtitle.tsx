import type { Me } from "@/lib/cloud-registry.types";

type Props = {
    me: Me | null;
    loading?: boolean;
    guest: string;
    user?: string;
    admin: string;
};

// admin mode shows only in the switch of the top bar (`AdminModeToggle`)
function PageSubtitle({ me, loading, guest, user, admin }: Props) {
    if (loading) {
        // the longest text, so the page doesn't move once the role is known
        const texts = [guest, user ?? "", admin];
        const longest = texts.reduce((a, b) => (b.length > a.length ? b : a));
        return <p className="leading-7 mt-2 invisible">{longest}</p>;
    }

    if (me?.admin) return <p className="leading-7 mt-2">{admin}</p>;

    return <p className="leading-7 mt-2">{me && user ? user : guest}</p>;
}

export default PageSubtitle;
