import { DocumentSequenceRepository } from '../database/repositories/document-sequence.repository';

export class PurchaseNumberService {
  private repo = new DocumentSequenceRepository();

  public nextPurchaseNumber(invoiceDate = new Date().toISOString()): string {
    const year = new Date(invoiceDate).getFullYear();
    return this.repo.next('PURCHASE', String(year), `PUR-${year}-`, 6);
  }
}
