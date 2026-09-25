import * as imageRepo from '../repositories/imageRepo';
import { badRequest, notFound } from '../utils/errors';
import { MAX_IMAGES_PER_USER } from '../config/constants';

const MAX_BYTES = 2 * 1024 * 1024;

export async function upload(userId: string, mime: string, base64: string) {
  const count = await imageRepo.countImagesForUser(userId);
  if ((count?.count ?? 0) >= MAX_IMAGES_PER_USER) throw badRequest('You have reached the picture upload limit for this account.');
  const data = Buffer.from(base64, 'base64');
  if (data.length === 0) throw badRequest('That picture could not be read.');
  if (data.length > MAX_BYTES) throw badRequest('Pictures must be 2 MB or smaller.');
  const row = await imageRepo.insertImage({ ownerUserId: userId, mime, sizeBytes: data.length, data });
  return row!.id;
}
export async function get(id: string) {
  const row = await imageRepo.findImage(id);
  if (!row) throw notFound('Image not found.');
  return row;
}
