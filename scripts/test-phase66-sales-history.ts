import './mock-electron';
import { initializeDatabase } from '../electron/database/database-initializer';
import { closeDatabaseConnection } from '../electron/database/database-connection';
import { ShopRepository } from '../electron/database/repositories/shop.repository';
import { CustomerRepository } from '../electron/database/repositories/customer.repository';
import { SalesService } from '../electron/services/sales.service';
import { ProductRepository } from '../electron/database/repositories/product.repository';

let passed = 0;
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  passed++;
  console.log(`SUCCESS: ${message}`);
}

async function run() {
  await initializeDatabase();
  const shop = new ShopRepository().getShop();
  assert(Boolean(shop), 'Existing shop is available');
  if (!shop) throw new Error('FAIL: shop missing');

  const customers = new CustomerRepository().list(shop.id, { page: 1, pageSize: 100 });
  const walkIn = customers.items.find(customer => customer.isWalkIn);
  assert(Boolean(walkIn), 'Walk-In customer is available');
  if (!walkIn) throw new Error('FAIL: walk-in missing');

  const sales = new SalesService();
  const draft = sales.createDraft(shop.id, walkIn.id);
  const product = new ProductRepository().findByNormalizedCode('prod-b');
  assert(Boolean(product), 'Existing product is available for held draft');
  if (!product) throw new Error('FAIL: product missing');
  sales.addDraftLine(draft.id, {
    productId: product.id,
    quantity: 1,
    provisionalUnitPrice: 50,
    provisionalDiscountType: 'NONE',
    provisionalDiscountValue: 0,
  });
  sales.holdBill(draft.id, shop.id);

  const all = sales.listSalesHistory({ shopId: shop.id, page: 1, pageSize: 100 });
  assert(all.items.some(item => item.status === 'POSTED' && Boolean(item.invoiceNumber)), 'Posted sale is visible');
  assert(all.items.some(item => item.id === draft.id && item.status === 'HELD'), 'Held sale is visible and distinguishable');

  const posted = sales.listSalesHistory({ shopId: shop.id, status: 'POSTED', page: 1, pageSize: 100 });
  assert(posted.items.length > 0 && posted.items.every(item => item.status === 'POSTED'), 'Sale status filter works');

  const firstInvoice = posted.items[0].invoiceNumber || '';
  const invoiceSearch = sales.listSalesHistory({ shopId: shop.id, invoiceNumber: firstInvoice, page: 1, pageSize: 100 });
  assert(invoiceSearch.items.some(item => item.invoiceNumber === firstInvoice), 'Invoice number filter works');

  const customerFilter = sales.listSalesHistory({ shopId: shop.id, customerId: walkIn.id, page: 1, pageSize: 100 });
  assert(customerFilter.items.length > 0 && customerFilter.items.every(item => item.customerId === walkIn.id), 'Customer filter works');

  const paymentFilter = sales.listSalesHistory({ shopId: shop.id, paymentStatus: 'PAID', page: 1, pageSize: 100 });
  assert(paymentFilter.items.length > 0 && paymentFilter.items.every(item => item.paymentStatus === 'PAID'), 'Payment status filter works');

  console.log(`PHASE 6.6 SALES HISTORY ASSERTIONS PASSED: ${passed}`);
  await closeDatabaseConnection();
}

run().catch(async error => {
  console.error(error);
  await closeDatabaseConnection().catch(() => undefined);
  process.exit(1);
});
