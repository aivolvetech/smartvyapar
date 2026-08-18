export interface DatabaseKeyProvider {
  hasKey(): Promise<boolean>;
  createKey(): Promise<string>;
  getKey(): Promise<string>;
  rotateStoredKey(newKey: string): Promise<void>;
  clearKey(): Promise<void>;
}
