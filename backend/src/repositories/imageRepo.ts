import { one, type Db } from '../db/pool';

export const insertImage = (p: { ownerUserId: string; mime: string; sizeBytes: number; data: Buffer }, db?: Db) =>
  one<{ id: string }>('insert into images (owner_user_id, mime, size_bytes, data) values ($1,$2,$3,$4) returning id', [p.ownerUserId, p.mime, p.sizeBytes, p.data], db);
export const findImage = (id: string, db?: Db) => one<{ mime: string; data: Buffer }>('select mime, data from images where id = $1', [id], db);
export const countImagesForUser = (userId: string, db?: Db) =>
  one<{ count: number }>('select count(*)::int as count from images where owner_user_id = $1', [userId], db);
