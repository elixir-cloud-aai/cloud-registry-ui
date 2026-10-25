import { useCallback, useState } from "react";

/**
 * Whether a web component form was changed: input events bubbling out of it
 * count, and a click on its "Reset" button clears them
 * (elixir-cloud-aai/cloud-components#462)
 * @returns the flag, its setter, and a ref callback for the form's wrapper
 */
function useFormChanged() {
    const [changed, setChanged] = useState(false);

    const watchForm = useCallback((el: HTMLElement | null) => {
        if (!el) return;
        const onChange = () => setChanged(true);
        const onClick = (e: MouseEvent) => {
            const reset = e
                .composedPath()
                .some(
                    (target) =>
                        target instanceof HTMLElement &&
                        target.localName === "ecc-utils-design-button" &&
                        target.textContent?.trim() === "Reset",
                );
            if (reset) setChanged(false);
        };
        const events = ["input", "change", "ecc-input-changed"];
        for (const type of events) el.addEventListener(type, onChange);
        el.addEventListener("click", onClick);
        return () => {
            for (const type of events) el.removeEventListener(type, onChange);
            el.removeEventListener("click", onClick);
        };
    }, []);

    return { changed, setChanged, watchForm };
}

export { useFormChanged };
