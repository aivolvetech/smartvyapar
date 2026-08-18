export interface ProductCategory {
  id: string;
  name: string;
  normalizedName: string;
  description: string | null;
  parentCategoryId: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductCategoryInput {
  name: string;
  description?: string;
  parentCategoryId?: string;
  displayOrder?: number;
}

export interface UpdateProductCategoryInput {
  name?: string;
  description?: string | null;
  parentCategoryId?: string | null;
  displayOrder?: number;
  isActive?: boolean;
}
