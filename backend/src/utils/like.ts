/** Turns user text into a safe ILIKE pattern (escapes the % _ and \\ wildcard characters). */
export const likePattern = (q: string): string => `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
