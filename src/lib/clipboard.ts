/**
 * Copy text to the clipboard
 * @param text The text
 * @returns Promise resolving once it is copied; it rejects if the browser
 * can't copy it, also outside secure contexts (HTTPS or localhost), where
 * the clipboard is missing
 */
async function copyText(text: string): Promise<void> {
    if (!navigator.clipboard) throw new Error("No clipboard");
    await navigator.clipboard.writeText(text);
}

export { copyText };
