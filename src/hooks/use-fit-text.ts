import { useLayoutEffect, useRef } from "react";

/**
 * Shrink an element's font below a maximum size until its text fits its
 * width on one line
 * @param maxSize Largest font size in pixels
 * @param text Text of the element, to fit it again when it changes
 * @returns a ref for the element, which must have a fixed width
 */
function useFitText<T extends HTMLElement>(maxSize: number, text?: string) {
    const ref = useRef<T>(null);

    // biome-ignore lint/correctness/useExhaustiveDependencies: refit on new text
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        const fit = () => {
            let size = maxSize;
            el.style.fontSize = `${size}px`;
            // text width isn't quite proportional to the size, so step down
            for (let i = 0; i < 50 && el.scrollWidth > el.clientWidth; i++) {
                size = Math.min(
                    size - 0.5,
                    (size * el.clientWidth) / el.scrollWidth,
                );
                el.style.fontSize = `${size}px`;
            }
        };
        fit();
        const observer = new ResizeObserver(fit);
        observer.observe(el);
        document.fonts?.ready.then(fit);
        return () => observer.disconnect();
    }, [maxSize, text]);

    return ref;
}

export { useFitText };
