import { asyncHandler } from '../utils/asyncHandler';
import * as imageService from '../services/imageService';
import { env } from '../config/env';

export const upload = asyncHandler(async (req, res) => {
  const id = await imageService.upload(req.auth!.userId, req.body.mime, req.body.base64);
  res.status(201).json({ id, url: `${env.PUBLIC_BASE_URL}/api/v1/images/${id}` });
});
export const get = asyncHandler(async (req, res) => {
  const row = await imageService.get(req.params.imageId);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Content-Type', row.mime);
  res.send(row.data);
});
