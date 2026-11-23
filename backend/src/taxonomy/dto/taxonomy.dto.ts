import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trim } from '../../common/transforms.js';

export class CreateTermDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase words joined by -',
  })
  @MaxLength(80)
  slug?: string;
}

export class UpdateTermDto extends PartialType(CreateTermDto) {}
