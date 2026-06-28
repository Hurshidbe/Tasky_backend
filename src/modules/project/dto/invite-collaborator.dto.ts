import { IsNotEmpty, IsOptional, IsString, Length, Matches } from "class-validator";

export class InviteCollaboratorDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Invalid project ID format' })
  projectId!: string;

  @IsNotEmpty()
  @IsString()
  emailOrUsername!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  message?: string;
}
