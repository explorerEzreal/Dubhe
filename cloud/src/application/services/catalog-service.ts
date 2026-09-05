import type { CatalogRepository } from '../ports.js';

export class CatalogService {
  constructor(private readonly catalog: CatalogRepository) {}

  async listModels(): Promise<Array<Record<string, unknown>>> {
    try {
      return await this.catalog.listModels();
    } catch (error) {
      throw error;
    }
  }

  async getUsage(userId: string): Promise<Record<string, unknown>> {
    try {
      return await this.catalog.getUsage(userId);
    } catch (error) {
      throw error;
    }
  }
}
