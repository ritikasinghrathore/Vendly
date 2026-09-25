import 'express';

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: 'customer' | 'shopkeeper'; sessionId: string };
      shop?: { id: string; memberRole: 'owner' | 'manager' };
      rawBody?: Buffer;
    }
  }
}
export {};
