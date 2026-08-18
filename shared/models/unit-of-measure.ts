export interface UnitOfMeasure {
  id: string;
  name: string;
  shortName: string;
  normalizedName: string;
  normalizedShortName: string;
  decimalAllowed: boolean;
  decimalPlaces: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUnitOfMeasureInput {
  name: string;
  shortName: string;
  decimalAllowed?: boolean;
  decimalPlaces?: number;
}

export interface UpdateUnitOfMeasureInput {
  name?: string;
  shortName?: string;
  decimalAllowed?: boolean;
  decimalPlaces?: number;
  isActive?: boolean;
}
