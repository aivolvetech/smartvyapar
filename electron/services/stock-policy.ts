import { Product } from '../../shared/models/product';
import { Shop } from '../../shared/models/shop';

export function resolveEffectiveNegativeStock(
  product: { negativeStockPolicy?: string; allowNegativeStock?: boolean },
  shop: { allowNegativeStockGlobally?: boolean }
): boolean {
  const policy = product.negativeStockPolicy || 'INHERIT';
  if (policy === 'ALLOW') return true;
  if (policy === 'BLOCK') return false;
  return Boolean(shop.allowNegativeStockGlobally);
}
