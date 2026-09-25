import { one, query, type Db } from '../db/pool';

export const insertNotification = (n: { userId: string | null; type: string; title: string; body?: string; data?: unknown }, db?: Db) =>
  query('insert into notifications (user_id, type, title, body, data) select $1,$2,$3,$4,$5 where $1 is not null',
    [n.userId, n.type, n.title, n.body ?? null, JSON.stringify(n.data ?? {})], db);
export const listNotificationsForUser = (userId: string, db?: Db) => query('select * from notifications where user_id = $1 order by created_at desc limit 60', [userId], db);
export const unreadCountForUser = (userId: string, db?: Db) =>
  one<{ count: number }>('select count(*)::int as count from notifications where user_id = $1 and read_at is null', [userId], db);
export const markAllRead = (userId: string, db?: Db) => query('update notifications set read_at = now() where user_id = $1 and read_at is null', [userId], db);
