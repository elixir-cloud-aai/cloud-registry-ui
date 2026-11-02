/** characters after which a long value, e.g. a URL or an ID, may break */
const segmentPattern = /[^/.?&=_:-]*(?:[/.?&=_:-]+|$)/g;

/**
 * Split a value into the segments between which it may break, e.g. a URL
 * after its slashes and dots, so that long values wrap at sensible points
 * instead of mid-word
 * @param value e.g. a URL, an ID or a name
 * @returns the segments, which join to the value; empty for an empty value
 */
function breakSegments(value: string): string[] {
    return Array.from(
        value.matchAll(segmentPattern),
        ([segment]) => segment,
    ).filter(Boolean);
}

export { breakSegments };
