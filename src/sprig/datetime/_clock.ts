/**
 * Clock seam for all date/time functions.
 *
 * [LAW:single-enforcer] Every function that reads "now" accepts a Clock
 * parameter injected by the factory closure — never calls `new Date()`
 * directly. One seam, not eleven.
 */
export type Clock = () => Date;
