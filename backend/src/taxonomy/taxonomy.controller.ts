import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard.js';
import { CreateTermDto, UpdateTermDto } from './dto/taxonomy.dto.js';
import { TaxonomyService, type TermKind } from './taxonomy.service.js';

function termControllers(kind: TermKind, path: string) {
  @Controller(path)
  class PublicTermsController {
    constructor(readonly taxonomy: TaxonomyService) {}

    @Get()
    list() {
      return this.taxonomy.list(kind);
    }
  }

  @Controller(`admin/${path}`)
  @UseGuards(AdminGuard)
  class AdminTermsController {
    constructor(readonly taxonomy: TaxonomyService) {}

    @Post()
    create(@Body() dto: CreateTermDto) {
      return this.taxonomy.create(kind, dto);
    }

    @Patch(':id')
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTermDto) {
      return this.taxonomy.update(kind, id, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    remove(@Param('id', ParseUUIDPipe) id: string) {
      return this.taxonomy.remove(kind, id);
    }
  }

  return [PublicTermsController, AdminTermsController];
}

export const taxonomyControllers = [
  ...termControllers('category', 'categories'),
  ...termControllers('tag', 'tags'),
];
