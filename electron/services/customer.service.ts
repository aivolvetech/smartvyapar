import { getDatabaseConnection } from '../database/database-connection';
import { CustomerRepository } from '../database/repositories/customer.repository';
import { ShopRepository } from '../database/repositories/shop.repository';
import { PriceBookRepository } from '../database/repositories/price-book.repository';
import {
  Customer,
  CustomerFilter,
  CustomerListResult,
  CreateCustomerInput,
  UpdateCustomerInput,
  DuplicateCustomerWarning,
  CustomerDetail,
} from '../../shared/models/customer';
import { validateCustomerFields } from './import/domain-rules';

export class CustomerService {
  private repo = new CustomerRepository();
  private shopRepo = new ShopRepository();
  private priceBookRepo = new PriceBookRepository();

  public listCustomers(filter: CustomerFilter): CustomerListResult {
    const shop = this.requireShop();
    return this.repo.list(shop.id, filter);
  }

  public getCustomerById(id: string): CustomerDetail | null {
    if (!id?.trim()) throw new Error('Customer ID is required.');
    const customer = this.repo.findById(id);
    if (!customer) return null;

    let priceBookName: string | null = null;
    if (customer.priceBookId) {
      const pb = this.priceBookRepo.findById(customer.priceBookId);
      if (pb) priceBookName = pb.name;
    }

    const { CustomerLedgerRepository } = require('../database/repositories/customer-ledger.repository');
    const ledgerRepo = new CustomerLedgerRepository();
    const outstandingSummary = ledgerRepo.getOutstanding(customer.id);

    return {
      customer,
      priceBookName,
      outstandingSummary,
    };
  }

  public createCustomer(input: CreateCustomerInput): Customer {
    const shop = this.requireShop();
    
    // Auto-generate customerCode if missing
    let customerCode = input.customerCode?.trim();
    if (!customerCode) {
      const db = getDatabaseConnection();
      const countRow = db.prepare("SELECT count(*) AS count FROM Customer WHERE isWalkIn = 0 AND shopId = ?").get(shop.id) as { count: number };
      const count = countRow.count ?? 0;
      let nextNum = count + 1;
      customerCode = `CUST-${String(nextNum).padStart(6, '0')}`;
      while (this.repo.findByNormalizedCode(shop.id, customerCode.toLowerCase())) {
        nextNum++;
        customerCode = `CUST-${String(nextNum).padStart(6, '0')}`;
      }
    }

    const validated = validateCustomerFields({ ...input, customerCode });
    const normalizedCode = validated.customerCode.trim().toLowerCase();
    
    // Block duplicate code
    const duplicate = this.repo.findByNormalizedCode(shop.id, normalizedCode);
    if (duplicate) throw new Error(`Customer code "${validated.customerCode}" already exists.`);

    // Block Walk-In creation through standard endpoint
    if (validated.customerType === 'WALK_IN') {
      throw new Error('Walk-In Customer cannot be created manually.');
    }

    // Validate PriceBook if supplied
    if (input.priceBookId) {
      const pb = this.priceBookRepo.findById(input.priceBookId);
      if (!pb) throw new Error('Price Book not found.');
      if (!pb.isActive) throw new Error('Selected Price Book is inactive.');
    }

    // Validate GST conflict
    if (validated.gstNumber) {
      const gstConflict = this.repo.findActiveByGst(shop.id, validated.gstNumber);
      if (gstConflict) {
        throw new Error(`GST number "${validated.gstNumber}" is already assigned to active customer "${gstConflict.name}".`);
      }
    }

    const normalizedPhone = validated.phone ? validated.phone.trim().replace(/[^0-9]/g, '') : null;

    return this.repo.create({
      shopId: shop.id,
      customerCode: validated.customerCode,
      normalizedCustomerCode: normalizedCode,
      name: validated.name,
      normalizedName: validated.name.trim().toLowerCase(),
      customerType: validated.customerType,
      contactPerson: validated.contactPerson,
      phone: validated.phone,
      normalizedPhone,
      alternatePhone: validated.alternatePhone,
      email: validated.email,
      gstNumber: validated.gstNumber,
      panNumber: validated.panNumber,
      billingAddressLine1: input.billingAddressLine1,
      billingAddressLine2: input.billingAddressLine2,
      shippingAddressLine1: input.shippingAddressLine1,
      shippingAddressLine2: input.shippingAddressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country,
      paymentTermsDays: validated.paymentTermsDays,
      creditLimit: validated.creditLimit,
      priceBookId: input.priceBookId,
      notes: input.notes,
      isWalkIn: 0,
    });
  }

  public updateCustomer(id: string, input: UpdateCustomerInput): Customer {
    if (!id?.trim()) throw new Error('Customer ID is required.');
    const existing = this.repo.findById(id);
    if (!existing) throw new Error('Customer not found.');

    // Protect Walk-In Customer fields
    if (existing.isWalkIn) {
      if (input.isActive === false) throw new Error('Walk-In Customer cannot be deactivated.');
      if (input.name && input.name !== existing.name) throw new Error('Walk-In Customer cannot be renamed.');
      if (input.customerType && input.customerType !== existing.customerType) throw new Error('Walk-In Customer type cannot be altered.');
      if (input.creditLimit !== undefined && input.creditLimit > 0) throw new Error('Walk-In Customer cannot have credit terms.');
      if (input.paymentTermsDays !== undefined && input.paymentTermsDays > 0) throw new Error('Walk-In Customer cannot have credit terms.');
    }

    const merged = {
      customerCode: existing.customerCode,
      name: input.name !== undefined ? input.name : existing.name,
      customerType: input.customerType !== undefined ? input.customerType : existing.customerType,
      contactPerson: input.contactPerson !== undefined ? input.contactPerson : existing.contactPerson,
      phone: input.phone !== undefined ? input.phone : existing.phone,
      alternatePhone: input.alternatePhone !== undefined ? input.alternatePhone : existing.alternatePhone,
      email: input.email !== undefined ? input.email : existing.email,
      gstNumber: input.gstNumber !== undefined ? input.gstNumber : existing.gstNumber,
      panNumber: input.panNumber !== undefined ? input.panNumber : existing.panNumber,
      paymentTermsDays: input.paymentTermsDays !== undefined ? input.paymentTermsDays : existing.paymentTermsDays,
      creditLimit: input.creditLimit !== undefined ? input.creditLimit : existing.creditLimit,
    };

    const validated = validateCustomerFields(merged);

    // Validate PriceBook if supplied
    if (input.priceBookId) {
      const pb = this.priceBookRepo.findById(input.priceBookId);
      if (!pb) throw new Error('Price Book not found.');
      if (!pb.isActive) throw new Error('Selected Price Book is inactive.');
    }

    // Validate GST conflict
    if (validated.gstNumber) {
      const gstConflict = this.repo.findActiveByGst(existing.shopId, validated.gstNumber);
      if (gstConflict && gstConflict.id !== id) {
        throw new Error(`GST number "${validated.gstNumber}" is already assigned to active customer "${gstConflict.name}".`);
      }
    }

    const normalizedPhone = validated.phone ? validated.phone.trim().replace(/[^0-9]/g, '') : null;

    return this.repo.update(id, {
      name: validated.name,
      normalizedName: validated.name.trim().toLowerCase(),
      customerType: validated.customerType,
      contactPerson: validated.contactPerson,
      phone: validated.phone,
      normalizedPhone,
      alternatePhone: validated.alternatePhone,
      email: validated.email,
      gstNumber: validated.gstNumber,
      panNumber: validated.panNumber,
      billingAddressLine1: input.billingAddressLine1,
      billingAddressLine2: input.billingAddressLine2,
      shippingAddressLine1: input.shippingAddressLine1,
      shippingAddressLine2: input.shippingAddressLine2,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country,
      paymentTermsDays: validated.paymentTermsDays,
      creditLimit: validated.creditLimit,
      priceBookId: input.priceBookId,
      notes: input.notes,
    });
  }

  public setCustomerActive(id: string, isActive: boolean): Customer {
    if (!id?.trim()) throw new Error('Customer ID is required.');
    const existing = this.repo.findById(id);
    if (!existing) throw new Error('Customer not found.');

    if (existing.isWalkIn && !isActive) {
      throw new Error('Walk-In Customer cannot be deactivated.');
    }

    this.repo.setActive(id, isActive);
    return this.repo.findById(id)!;
  }

  public checkDuplicates(input: { phone?: string; gstNumber?: string }): DuplicateCustomerWarning[] {
    const shop = this.requireShop();
    const warnings: DuplicateCustomerWarning[] = [];

    if (input.gstNumber?.trim()) {
      const match = this.repo.findActiveByGst(shop.id, input.gstNumber.trim().toUpperCase());
      if (match) {
        warnings.push({
          field: 'gstNumber',
          message: `GST number is already in use by active customer "${match.name}".`,
          existingCustomerId: match.id,
        });
      }
    }

    if (input.phone?.trim()) {
      const norm = input.phone.trim().replace(/[^0-9]/g, '');
      if (norm) {
        const match = this.repo.findActiveByPhone(shop.id, norm);
        if (match) {
          warnings.push({
            field: 'phone',
            message: `Phone number is already in use by active customer "${match.name}".`,
            existingCustomerId: match.id,
          });
        }
      }
    }

    return warnings;
  }

  public ensureWalkInCustomer(shopId: string): Customer {
    const existing = this.repo.findWalkIn(shopId);
    if (existing) return existing;

    return this.repo.create({
      shopId,
      customerCode: 'WALK-IN',
      normalizedCustomerCode: 'walk-in',
      name: 'Walk-In Customer',
      normalizedName: 'walk-in customer',
      customerType: 'WALK_IN',
      isWalkIn: 1,
      paymentTermsDays: 0,
      creditLimit: 0,
    });
  }

  private requireShop() {
    const shop = this.shopRepo.getShop();
    if (!shop) throw new Error('Shop profile is required before customer operations can be performed.');
    return shop;
  }
}
