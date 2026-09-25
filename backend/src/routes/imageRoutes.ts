import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { uploadImageSchema } from '../validators/images';
import * as ctrl from '../controllers/imageController';

export const imageRoutes = Router();
imageRoutes.post('/', requireAuth, validate(uploadImageSchema), ctrl.upload);
// Served without auth, like a CDN, so a plain <Image source={{uri}}> works from the app with no extra
// headers; images are addressed by an unguessable UUID and carry nothing sensitive (shop/product photos).
imageRoutes.get('/:imageId', ctrl.get);
