import { prisma } from '@/lib/prisma';
import { slugify } from '@/lib/utils';

export class CategoryResolver {
  private map = new Map<string, string>();
  private createdIds: string[] = [];

  constructor(categories: { id: string; name: string }[]) {
    for (const c of categories) {
      this.map.set(c.name.toLowerCase(), c.id);
    }
  }

  get createdCategoryIds() {
    return [...this.createdIds];
  }

  async resolve(name: string, autoCreate: boolean): Promise<string | null> {
    const key = name.trim().toLowerCase();
    if (!key) return null;

    const existing = this.map.get(key);
    if (existing) return existing;

    if (!autoCreate) return null;

    const slug = slugify(name);
    const cat = await prisma.category.create({
      data: { name: name.trim(), slug },
    });
    this.map.set(key, cat.id);
    this.createdIds.push(cat.id);
    return cat.id;
  }
}
