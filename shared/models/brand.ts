export interface Brand {
  id: string;
  name: string;
  normalizedName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandInput {
  name: string;
  description?: string;
}

export interface UpdateBrandInput {
  name?: string;
  description?: string | null;
  isActive?: boolean;
}
