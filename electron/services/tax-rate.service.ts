import { TaxRateRepository } from '../database/repositories/tax-rate.repository';
import { TaxRateData } from '../../shared/types/ipc';
import { TaxRate } from '../../shared/models/tax-rate';

function toData(t: TaxRate): TaxRateData {
  return {
    id: t.id, name: t.name, rate: t.rate, taxType: t.taxType,
    cgstRate: t.cgstRate, sgstRate: t.sgstRate, igstRate: t.igstRate, cessRate: t.cessRate,
    effectiveFrom: t.effectiveFrom, effectiveTo: t.effectiveTo,
    isActive: t.isActive, createdAt: t.createdAt, updatedAt: t.updatedAt,
  };
}

export class TaxRateService {
  private repo = new TaxRateRepository();

  public async listTaxRates(activeOnly = false): Promise<TaxRateData[]> {
    return this.repo.listAll(activeOnly).map(toData);
  }
}
