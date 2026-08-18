import { ProductRepository } from '../database/repositories/product.repository';
import { TaxRateRepository } from '../database/repositories/tax-rate.repository';
import { UnitOfMeasureRepository } from '../database/repositories/unit-of-measure.repository';
import { ShopRepository } from '../database/repositories/shop.repository';
import { SupplierRepository } from '../database/repositories/supplier.repository';
import {
  PurchaseCalculationResult,
  PurchaseDiscountType,
  PurchaseDraftInput,
  PurchaseLineInput,
} from '../../shared/models/supplier-purchase';

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function numberOrZero(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function discountAmount(base: number, type: PurchaseDiscountType, value: number): number {
  if (type === 'NONE') return 0;
  if (type === 'PERCENT') {
    if (value > 100) throw new Error('Discount percent cannot exceed 100.');
    return money(base * value / 100);
  }
  return money(value);
}

export class PurchaseCalculationService {
  private productRepo = new ProductRepository();
  private taxRepo = new TaxRateRepository();
  private unitRepo = new UnitOfMeasureRepository();
  private shopRepo = new ShopRepository();
  private supplierRepo = new SupplierRepository();

  public calculate(input: PurchaseDraftInput): PurchaseCalculationResult {
    const supplier = this.supplierRepo.findById(input.supplierId);
    if (!supplier) throw new Error('Supplier not found.');
    const shop = this.shopRepo.getShop();
    if (!shop) throw new Error('Shop profile is required.');
    const lines = input.lines || [];
    if (lines.length === 0) {
      return {
        lines: [],
        subtotal: 0,
        lineDiscountTotal: 0,
        invoiceDiscountTotal: 0,
        taxableAmount: 0,
        cgstTotal: 0,
        sgstTotal: 0,
        igstTotal: 0,
        cessTotal: 0,
        roundOff: 0,
        grandTotal: 0,
      };
    }

    const rawLines = lines.map(line => this.calculateLine(line, this.isInterState(shop.gstNumber, supplier.state, shop.address, supplier.gstNumber)));
    const subtotal = money(rawLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
    const lineDiscountTotal = money(rawLines.reduce((sum, line) => sum + line.discountAmount, 0));
    const preInvoiceTaxable = money(rawLines.reduce((sum, line) => sum + line.taxableAmount, 0));
    const invoiceDiscountType = input.invoiceDiscountType || 'NONE';
    const invoiceDiscountValue = numberOrZero(input.invoiceDiscountValue);
    const invoiceDiscountTotal = discountAmount(preInvoiceTaxable, invoiceDiscountType, invoiceDiscountValue);
    if (invoiceDiscountTotal > preInvoiceTaxable) throw new Error('Invoice discount cannot exceed taxable amount.');

    let allocated = 0;
    const adjustedLines = rawLines.map((line, index) => {
      const share = preInvoiceTaxable > 0
        ? (index === rawLines.length - 1 ? money(invoiceDiscountTotal - allocated) : money(invoiceDiscountTotal * (line.taxableAmount / preInvoiceTaxable)))
        : 0;
      allocated = money(allocated + share);
      return this.recalculateTaxes({ ...line, taxableAmount: money(line.taxableAmount - share) });
    });

    const taxableAmount = money(adjustedLines.reduce((sum, line) => sum + line.taxableAmount, 0));
    const cgstTotal = money(adjustedLines.reduce((sum, line) => sum + line.cgstAmount, 0));
    const sgstTotal = money(adjustedLines.reduce((sum, line) => sum + line.sgstAmount, 0));
    const igstTotal = money(adjustedLines.reduce((sum, line) => sum + line.igstAmount, 0));
    const cessTotal = money(adjustedLines.reduce((sum, line) => sum + line.cessAmount, 0));
    const beforeRound = money(taxableAmount + cgstTotal + sgstTotal + igstTotal + cessTotal);
    const rounded = Math.round(beforeRound);
    const roundOff = money(rounded - beforeRound);

    return {
      lines: adjustedLines.map(line => ({ ...line, lineTotal: money(line.taxableAmount + line.cgstAmount + line.sgstAmount + line.igstAmount + line.cessAmount) })),
      subtotal,
      lineDiscountTotal,
      invoiceDiscountTotal,
      taxableAmount,
      cgstTotal,
      sgstTotal,
      igstTotal,
      cessTotal,
      roundOff,
      grandTotal: money(beforeRound + roundOff),
    };
  }

  private calculateLine(input: PurchaseLineInput, interState: boolean) {
    if (!input.productId?.trim()) throw new Error('Product is required.');
    const product = this.productRepo.findById(input.productId);
    if (!product) throw new Error('Product not found.');
    if (!product.isActive) throw new Error(`Product "${product.name}" is inactive.`);
    const quantity = numberOrZero(input.quantity);
    const unitPrice = numberOrZero(input.unitPrice);
    const mrp = numberOrZero(input.mrp);
    if (quantity <= 0) throw new Error('Quantity must be greater than zero.');
    if (unitPrice < 0) throw new Error('Unit price cannot be negative.');
    if (mrp < 0) throw new Error('MRP cannot be negative.');
    const lookups = this.productRepo.getDetailLookups(product.id);
    const taxRate = input.taxRateId ? this.taxRepo.findById(input.taxRateId) : (product.taxRateId ? this.taxRepo.findById(product.taxRateId) : null);
    const unit = product.primaryUnitId ? this.unitRepo.findById(product.primaryUnitId) : null;
    const base = money(quantity * unitPrice);
    const type = input.discountType || 'NONE';
    const value = numberOrZero(input.discountValue);
    const lineDiscount = discountAmount(base, type, value);
    if (lineDiscount > base) throw new Error('Line discount cannot exceed line amount.');
    const taxableAmount = money(base - lineDiscount);
    const taxType = taxRate?.taxType || 'NON_GST';
    const taxSnapshot = taxRate?.rate ?? 0;
    const cgstRate = taxType === 'GST' && !interState ? (taxRate?.cgstRate ?? taxSnapshot / 2) : 0;
    const sgstRate = taxType === 'GST' && !interState ? (taxRate?.sgstRate ?? taxSnapshot / 2) : 0;
    const igstRate = taxType === 'GST' && interState ? (taxRate?.igstRate ?? taxSnapshot) : 0;
    const cessRate = taxType === 'GST' ? (taxRate?.cessRate ?? 0) : 0;
    return this.recalculateTaxes({
      productId: product.id,
      productCodeSnapshot: product.productCode,
      productNameSnapshot: product.name,
      hsnSacCodeSnapshot: product.hsnSacCode,
      taxRateId: taxRate?.id ?? null,
      taxRateSnapshot: taxSnapshot,
      quantity,
      unitId: product.primaryUnitId,
      unitNameSnapshot: lookups.unitShortName || unit?.shortName || unit?.name || null,
      unitPrice,
      mrp,
      discountType: type,
      discountValue: value,
      discountAmount: lineDiscount,
      taxableAmount,
      cgstRate,
      cgstAmount: 0,
      sgstRate,
      sgstAmount: 0,
      igstRate,
      igstAmount: 0,
      cessRate,
      cessAmount: 0,
      lineTotal: 0,
    });
  }

  private recalculateTaxes<T extends {
    taxableAmount: number;
    cgstRate: number;
    sgstRate: number;
    igstRate: number;
    cessRate: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    lineTotal: number;
  }>(line: T): T {
    line.cgstAmount = money(line.taxableAmount * line.cgstRate / 100);
    line.sgstAmount = money(line.taxableAmount * line.sgstRate / 100);
    line.igstAmount = money(line.taxableAmount * line.igstRate / 100);
    line.cessAmount = money(line.taxableAmount * line.cessRate / 100);
    line.lineTotal = money(line.taxableAmount + line.cgstAmount + line.sgstAmount + line.igstAmount + line.cessAmount);
    return line;
  }

  private isInterState(
    shopGst: string | null | undefined,
    supplierState: string | null | undefined,
    shopAddress: string | null | undefined,
    supplierGst?: string | null | undefined
  ): boolean {
    if (!supplierState) return false;
    if (shopGst && supplierGst && /^[0-9]{2}/.test(shopGst) && /^[0-9]{2}/.test(supplierGst)) {
      return shopGst.substring(0, 2) !== supplierGst.substring(0, 2);
    }
    if (!shopAddress) return false;
    return !shopAddress.toLowerCase().includes(supplierState.toLowerCase());
  }
}
