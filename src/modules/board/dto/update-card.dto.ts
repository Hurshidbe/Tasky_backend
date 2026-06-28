import { PartialType } from '@nestjs/mapped-types';
import { CreateCardDto } from './create-card.dto.js';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class UpdateCardDto extends PartialType(CreateCardDto) {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Invalid card ID format' })
  id!: string;
}
