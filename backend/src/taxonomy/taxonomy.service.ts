import { Injectable } from '@nestjs/common';
import { uniqueSlug } from '../common/slug.js';
import { PostCacheService } from '../posts/post-cache.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTermDto, UpdateTermDto } from './dto/taxonomy.dto.js';

export type TermKind = 'category' | 'tag';

/** Categories and tags share the same shape (name + unique slug) and lifecycle. */
@Injectable()
export class TaxonomyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: PostCacheService,
  ) {}

  list(kind: TermKind) {
    return this.delegate(kind).findMany({ orderBy: { name: 'asc' } });
  }

  async create(kind: TermKind, dto: CreateTermDto) {
    // An explicit slug is used as given (duplicates → 409); a generated one never
    // collides or comes out empty ("C++" and "C#" become "c" and "c-2").
    const slug =
      dto.slug ??
      (await uniqueSlug(dto.name, async (candidate) =>
        Boolean(
          await this.delegate(kind).findUnique({ where: { slug: candidate } }),
        ),
      ));
    const term = await this.delegate(kind).create({
      data: { name: dto.name, slug },
    });
    await this.cache.invalidateAll();
    return term;
  }

  async update(kind: TermKind, id: string, dto: UpdateTermDto) {
    const term = await this.delegate(kind).update({
      where: { id },
      data: { name: dto.name, slug: dto.slug },
    });
    await this.cache.invalidateAll();
    return term;
  }

  async remove(kind: TermKind, id: string) {
    await this.delegate(kind).delete({ where: { id } });
    await this.cache.invalidateAll();
  }

  // Both delegates expose the same CRUD signatures for { id, name, slug }.
  private delegate(kind: TermKind) {
    return (
      kind === 'category' ? this.prisma.category : this.prisma.tag
    ) as typeof this.prisma.tag;
  }
}
