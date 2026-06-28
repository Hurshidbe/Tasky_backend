import { IsNotEmpty, IsString, Matches } from "class-validator";

export class CreateCardDto {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Invalid project ID format' })
  projectId!: string;
}
