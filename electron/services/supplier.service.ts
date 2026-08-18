import { getDatabaseConnection } from '../database/database-connection';
import { ShopRepository } from '../database/repositories/shop.repository';
import { SupplierRepository, normalizeSupplierText } from '../database/repositories/supplier.repository';
import {
  CreateSupplierInput,
  Supplier,
  SupplierFilter,
  SupplierListResult,
  UpdateSupplierInput,
  SupplierOpeningBalanceType,
} from '../../shared/models/supplier-purchase';
import { SupplierLedgerService } from './supplier-ledger.service';
import { validateSupplierFields } from './import/domain-rules';

interface SupplierValidationInput {
  supplierCode?: string;
  name?: string;
  contactPerson?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  paymentTermsDays?: number | null;
  creditLimit?: number | null;
  openingBalance?: number | null;
  openingBalanceType?: SupplierOpeningBalanceType | null;
  notes?: string | null;
  isActive?: boolean | null;
}

function numberOrZero(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export class SupplierService {
  private repo = new SupplierRepository();
  private shopRepo = new ShopRepository();
  private ledger = new SupplierLedgerService();

  public listSuppliers(filter: SupplierFilter): SupplierListResult {
    return this.repo.list(filter);
  }

  public getSupplierById(id: string): Supplier | null {
    if (!id?.trim()) throw new Error('Supplier ID is required.');
    return this.repo.findById(id);
  }

  public createSupplier(input: CreateSupplierInput): Supplier {
    const prepared = this.validate(input);
    const duplicate = this.repo.findByNormalizedCode(normalizeSupplierText(prepared.supplierCode));
    if (duplicate) throw new Error(`Supplier code "${prepared.supplierCode}" already exists.`);
    const shop = this.shopRepo.getShop();
    if (!shop) throw new Error('Shop profile is required before creating suppliers.');
    const db = getDatabaseConnection();
    return db.transaction(() => {
      const supplier = this.repo.create(prepared);
      this.ledger.recordOpening({
        supplierId: supplier.id,
        shopId: shop.id,
        amount: supplier.openingBalance,
        type: supplier.openingBalanceType,
      });
      return this.repo.findById(supplier.id)!;
    })();
  }

  public updateSupplier(id: string, input: UpdateSupplierInput): Supplier {
    if (!id?.trim()) throw new Error('Supplier ID is required.');
    const existing = this.repo.findById(id);
    if (!existing) throw new Error('Supplier not found.');
    const prepared = this.validate({ ...existing, ...input });
    const duplicate = this.repo.findByNormalizedCode(normalizeSupplierText(prepared.supplierCode));
    if (duplicate && duplicate.id !== id) throw new Error(`Supplier code "${prepared.supplierCode}" already exists.`);
    if (this.repo.isReferenced(id) && input.openingBalance !== undefined && input.openingBalance !== existing.openingBalance) {
      throw new Error('Opening balance cannot be changed after supplier is referenced.');
    }
    return this.repo.update(id, prepared);
  }

  public setSupplierActive(id: string, active: boolean): Supplier {
    if (!id?.trim()) throw new Error('Supplier ID is required.');
    return this.repo.setActive(id, active);
  }

  /**
   * Validates and normalizes supplier input.
   * Delegates all field-level rules to the shared validateSupplierFields() in domain-rules.ts.
   * Both this service and SupplierImportProcessor call that shared function.
   */
  private validate(input: SupplierValidationInput): Required<CreateSupplierInput> {
    const validated = validateSupplierFields(input as any);
    return {
      supplierCode: validated.supplierCode,
      name: validated.name,
      contactPerson: (input.contactPerson || '').trim(),
      phone: validated.phone,
      alternatePhone: validated.alternatePhone,
      email: validated.email,
      gstNumber: validated.gstNumber,
      panNumber: validated.panNumber,
      addressLine1: input.addressLine1 || '',
      addressLine2: input.addressLine2 || '',
      city: input.city || '',
      state: input.state || '',
      postalCode: input.postalCode || '',
      country: input.country || 'India',
      paymentTermsDays: validated.paymentTermsDays,
      creditLimit: validated.creditLimit,
      openingBalance: validated.openingBalance,
      openingBalanceType: validated.openingBalanceType,
      notes: input.notes || '',
      isActive: input.isActive !== false,
    };
  }
}
