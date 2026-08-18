import { UnitOfMeasureRepository } from '../database/repositories/unit-of-measure.repository';
import { UnitOfMeasureData, CreateUnitInput, UpdateUnitInput } from '../../shared/types/ipc';
import { UnitOfMeasure } from '../../shared/models/unit-of-measure';

function toData(u: UnitOfMeasure): UnitOfMeasureData {
  return {
    id: u.id,
    name: u.name,
    shortName: u.shortName,
    decimalAllowed: u.decimalAllowed,
    decimalPlaces: u.decimalPlaces,
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export class UnitOfMeasureService {
  private repo = new UnitOfMeasureRepository();

  public async listUnits(activeOnly = false): Promise<UnitOfMeasureData[]> {
    return this.repo.listAll(activeOnly).map(toData);
  }

  public async createUnit(input: CreateUnitInput): Promise<UnitOfMeasureData> {
    if (!input.name || !input.name.trim()) throw new Error('Unit name is required.');
    if (!input.shortName || !input.shortName.trim()) throw new Error('Short name is required.');

    const decimalAllowed = input.decimalAllowed ?? false;
    const decimalPlaces = decimalAllowed ? (input.decimalPlaces ?? 3) : 0;

    if (decimalAllowed && (decimalPlaces < 0 || decimalPlaces > 6)) {
      throw new Error('Decimal places must be between 0 and 6.');
    }

    const normName = input.name.trim().toLowerCase().replace(/\s+/g, ' ');
    const normShort = input.shortName.trim().toLowerCase().replace(/\s+/g, ' ');

    if (this.repo.findByNormalizedName(normName)) {
      throw new Error(`A unit named "${input.name.trim()}" already exists.`);
    }
    if (this.repo.findByNormalizedShortName(normShort)) {
      throw new Error(`A unit with short name "${input.shortName.trim()}" already exists.`);
    }

    return toData(this.repo.create({ name: input.name.trim(), shortName: input.shortName.trim(), decimalAllowed, decimalPlaces }));
  }

  public async updateUnit(id: string, input: UpdateUnitInput): Promise<UnitOfMeasureData> {
    const existing = this.repo.findById(id);
    if (!existing) throw new Error('Unit not found.');

    if (input.isActive === false && this.repo.isUsedByProduct(id)) {
      throw new Error('Cannot deactivate a unit used by active products. Reassign products first.');
    }

    if (input.name) {
      const normName = input.name.trim().toLowerCase().replace(/\s+/g, ' ');
      const dup = this.repo.findByNormalizedName(normName);
      if (dup && dup.id !== id) throw new Error(`A unit named "${input.name.trim()}" already exists.`);
    }
    if (input.shortName) {
      const normShort = input.shortName.trim().toLowerCase().replace(/\s+/g, ' ');
      const dup = this.repo.findByNormalizedShortName(normShort);
      if (dup && dup.id !== id) throw new Error(`A unit with short name "${input.shortName.trim()}" already exists.`);
    }

    return toData(this.repo.update(id, input));
  }
}
