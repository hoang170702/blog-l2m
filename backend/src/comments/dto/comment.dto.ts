import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQuery } from '../../common/pagination.js';
import { CommentStatus } from '../../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCommentDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  authorName: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}

export class AdminCommentQuery extends PaginationQuery {
  @IsOptional()
  @IsEnum(CommentStatus)
  status?: CommentStatus;
}

export class ModerateCommentDto {
  @IsEnum(CommentStatus)
  status: CommentStatus;
}
