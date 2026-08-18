import { BrandRepository } from '../database/repositories/brand.repository';
import { BrandData, CreateBrandInput, UpdateBrandInput } from '../../shared/types/ipc';
import { Brand } from '../../shared/models/brand';

function toData(b: Brand): BrandData {
  return { id: b.id, name: b.name, description: b.description, isActive: b.isActive, createdAt: b.createdAt, updatedAt: b.updatedAt };
}

export class BrandService {
  private repo = new BrandRepository();

  public async listBrands(activeOnly = false): Promise<BrandData[]> {
    return this.repo.listAll(activeOnly).map(toData);
  }

  public async createBrand(input: CreateBrandInput): Promise<BrandData> {
    if (!input.name || !input.name.trim()) throw new Error('Brand name is required.');
    const normName = input.name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (this.repo.findByNormalizedName(normName)) throw new Error(`Brand "${input.name.trim()}" already exists.`);
    return toData(this.repo.create({ name: input.name.trim(), description: input.description }));
  }

  public async updateBrand(id: string, input: UpdateBrandInput): Promise<BrandData> {
    const existing = this.repo.findById(id);
    if (!existing) throw new Error('Brand not found.');
    if (input.isActive === false && this.repo.isUsedByProduct(id)) {
      throw new Error('Cannot deactivate a brand used by active products.');
    }
    if (input.name) {
      const normName = input.name.trim().toLowerCase().replace(/\s+/g, ' ');
      const dup = this.repo.findByNormalizedName(normName);
      if (dup && dup.id !== id) throw new Error(`Brand "${input.name.trim()}" already exists.`);
    }
    return toData(this.repo.update(id, input));
  }
}
