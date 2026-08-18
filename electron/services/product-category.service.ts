import { ProductCategoryRepository } from '../database/repositories/product-category.repository';
import { ProductCategoryData, CreateCategoryInput, UpdateCategoryInput } from '../../shared/types/ipc';
import { ProductCategory } from '../../shared/models/product-category';

const MAX_DEPTH = 3;

function toData(c: ProductCategory): ProductCategoryData {
  return {
    id: c.id,
    name: c.name,
    description: c.description,
    parentCategoryId: c.parentCategoryId,
    displayOrder: c.displayOrder,
    isActive: c.isActive,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export class ProductCategoryService {
  private repo = new ProductCategoryRepository();

  public async listCategories(activeOnly = false): Promise<ProductCategoryData[]> {
    return this.repo.listAll(activeOnly).map(toData);
  }

  public async createCategory(input: CreateCategoryInput): Promise<ProductCategoryData> {
    if (!input.name || !input.name.trim()) throw new Error('Category name is required.');

    const parentId = input.parentCategoryId || null;

    if (parentId) {
      const parent = this.repo.findById(parentId);
      if (!parent) throw new Error('Parent category not found.');
      if (!parent.isActive) throw new Error('Cannot add a sub-category to an inactive parent.');

      // Validate hierarchy depth
      const ancestors = this.repo.getAncestorIds(parentId);
      // ancestors includes parentId chain; depth of new child = ancestors.length + 1 (parent) + 1 (self)
      if (ancestors.length + 2 > MAX_DEPTH) {
        throw new Error(`Category hierarchy cannot exceed ${MAX_DEPTH} levels.`);
      }
    }

    const normName = input.name.trim().toLowerCase().replace(/\s+/g, ' ');
    const dup = this.repo.findByNormalizedNameAndParent(normName, parentId);
    if (dup) throw new Error(`A category named "${input.name.trim()}" already exists in this level.`);

    return toData(this.repo.create({ ...input, name: input.name.trim() }));
  }

  public async updateCategory(id: string, input: UpdateCategoryInput): Promise<ProductCategoryData> {
    const existing = this.repo.findById(id);
    if (!existing) throw new Error('Category not found.');

    // Reject self-parenting
    if (input.parentCategoryId === id) throw new Error('A category cannot be its own parent.');

    // Reject circular hierarchy
    if (input.parentCategoryId) {
      const ancestors = this.repo.getAncestorIds(input.parentCategoryId);
      if (ancestors.includes(id)) throw new Error('Circular category hierarchy detected.');

      // Validate new depth
      const newAncestors = this.repo.getAncestorIds(input.parentCategoryId);
      if (newAncestors.length + 2 > MAX_DEPTH) {
        throw new Error(`Category hierarchy cannot exceed ${MAX_DEPTH} levels.`);
      }
    }

    if (input.isActive === false && this.repo.isUsedByProduct(id)) {
      throw new Error('Cannot deactivate a category used by active products.');
    }

    if (input.name) {
      const normName = input.name.trim().toLowerCase().replace(/\s+/g, ' ');
      const parentId = input.parentCategoryId !== undefined ? input.parentCategoryId : existing.parentCategoryId;
      const dup = this.repo.findByNormalizedNameAndParent(normName, parentId);
      if (dup && dup.id !== id) throw new Error(`A category named "${input.name.trim()}" already exists at this level.`);
    }

    return toData(this.repo.update(id, input));
  }
}
