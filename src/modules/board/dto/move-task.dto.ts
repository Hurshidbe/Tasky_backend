import { IsNotEmpty, IsNumber, IsOptional, IsMongoId } from "class-validator";

export class MoveTaskDto {
  @IsNotEmpty()
  @IsMongoId({ message: 'Invalid task ID format' })
  taskId!: string;

  @IsNotEmpty()
  @IsMongoId({ message: 'Invalid target column ID format' })
  toColumnId!: string;

  @IsOptional()
  @IsMongoId({ message: 'Invalid source column ID format' })
  fromColumnId?: string;

  @IsOptional()
  @IsNumber()
  newIndex?: number;
}
