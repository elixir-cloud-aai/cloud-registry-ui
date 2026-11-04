/**
 * @description errors of the registry's client in tests, which carry the
 * response's status and fields of its body
 */

/**
 * An error as the registry's client throws it
 * @param status HTTP status of the response
 * @param fields Fields of the response's body, e.g. `detail`
 * @returns The error
 */
export const failure = (status: number, fields: Record<string, unknown> = {}) =>
    Object.assign(new Error("x"), { status, ...fields });
