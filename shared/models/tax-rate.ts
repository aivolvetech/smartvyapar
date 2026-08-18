export type TaxType = 'GST' | 'EXEMPT' | 'ZERO_RATED' | 'NON_GST';

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  taxType: TaxType;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cessRate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaxRateInput {
  name: string;
  rate: number;
  taxType: TaxType;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cessRate?: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface UpdateTaxRateInput {
  name?: string;
  effectiveTo?: string;
  isActive?: boolean;
}
