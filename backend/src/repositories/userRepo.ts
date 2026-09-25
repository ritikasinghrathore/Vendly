import { one, query, type Db } from '../db/pool';

export interface UserRow {
  id: string; email: string; password_hash: string; name: string; phone: string | null;
  role: 'customer' | 'shopkeeper'; is_active: boolean; failed_logins: number; locked_until: string | null;
  created_at: string;
}

export const findByEmail = (email: string, db?: Db) => one<UserRow>('select * from users where email = $1', [email], db);
export const findById = (id: string, db?: Db) => one<UserRow>('select * from users where id = $1', [id], db);
export const createUser = (u: { email: string; passwordHash: string; name: string; phone?: string; role: string }, db?: Db) =>
  one<UserRow>('insert into users (email, password_hash, name, phone, role) values ($1,$2,$3,$4,$5) returning *',
    [u.email, u.passwordHash, u.name, u.phone ?? null, u.role], db);
export const recordLoginSuccess = (id: string, db?: Db) =>
  query('update users set failed_logins = 0, locked_until = null, last_login_at = now() where id = $1', [id], db);
export const recordLoginFailure = (id: string, lockUntil: string | null, db?: Db) =>
  query('update users set failed_logins = failed_logins + 1, locked_until = $2 where id = $1', [id, lockUntil], db);
export const updateProfile = (id: string, patch: { name?: string; phone?: string | null }, db?: Db) =>
  one<UserRow>(
    `update users set name = coalesce($2, name), phone = case when $3 then $4 else phone end where id = $1 returning *`,
    [id, patch.name ?? null, 'phone' in patch, patch.phone ?? null], db,
  );
export const updatePasswordHash = (id: string, passwordHash: string, db?: Db) =>
  query('update users set password_hash = $2 where id = $1', [id, passwordHash], db);
export const deactivateUser = (id: string, db?: Db) => query('update users set is_active = false where id = $1', [id], db);
