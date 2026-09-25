import argon2 from 'argon2';

// argon2id: resistant to both GPU-cracking and side-channel attacks. Cost tuned for an interactive login.
const OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain, OPTS);
export const verifyPassword = (hash: string, plain: string): Promise<boolean> => argon2.verify(hash, plain).catch(() => false);
