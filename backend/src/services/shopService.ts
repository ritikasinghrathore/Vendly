import { withTx } from '../db/pool';
import * as shopRepo from '../repositories/shopRepo';
import * as subscriptionRepo from '../repositories/subscriptionRepo';
import { env } from '../config/env';
import { MAX_SHOPS_PER_USER } from '../config/constants';
import { badRequest } from '../utils/errors';

const CAMEL_TO_SNAKE: Record<string, string> = {
  name: 'name', ownerName: 'owner_name', tagline: 'tagline', description: 'description', shopType: 'shop_type',
  phone: 'phone', addressLine: 'address_line', area: 'area', city: 'city', state: 'state', pincode: 'pincode',
  isOpen: 'is_open', logoImageId: 'logo_image_id',
};

export async function createShop(ownerUserId: string, input: Record<string, unknown>) {
  return withTx(async (tx) => {
    const count = await shopRepo.countShopsOwnedBy(ownerUserId, tx);
    if ((count?.count ?? 0) >= MAX_SHOPS_PER_USER) throw badRequest(`One account can have up to ${MAX_SHOPS_PER_USER} shops.`);

    const shop = await shopRepo.insertShop({
      ownerUserId, name: input.name, ownerName: input.ownerName, tagline: input.tagline, description: input.description,
      shopType: input.shopType, phone: input.phone, addressLine: input.addressLine, area: input.area,
      city: input.city, state: input.state, pincode: input.pincode,
    }, tx);
    await shopRepo.addShopMember(shop!.id, ownerUserId, 'owner', tx);

    // Every new shop gets a subscription row from day one, in "incomplete" status - the single place
    // access checks look, right from shop creation, with no separate provisioning step later.
    const trialDays = env.TRIAL_DAYS;
    const sub = await subscriptionRepo.insertSubscription({ userId: ownerUserId, shopId: shop!.id, provider: env.PAYMENT_PROVIDER }, tx);
    if (trialDays > 0) {
      const trialEnd = new Date(Date.now() + trialDays * 86_400_000);
      await subscriptionRepo.updateSubscription(sub!.id, { status: 'trial', trial_ends_at: trialEnd.toISOString(), access_until: trialEnd.toISOString() }, tx);
    }
    return shop!;
  });
}

export const myShops = (userId: string) => shopRepo.listShopsForMember(userId);
export const listBrowsableShops = () => shopRepo.listActiveShops();
export const searchShops = (q: string) => shopRepo.searchShops(q);
export const getShop = (id: string) => shopRepo.findShopById(id);

export function updateShop(shopId: string, input: Record<string, unknown>) {
  const patch: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE)) {
    if (camel in input) patch[snake] = input[camel];
  }
  return shopRepo.updateShop(shopId, patch);
}
