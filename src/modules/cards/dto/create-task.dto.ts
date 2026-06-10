import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches } from "class-validator";

export class CreateTaskDto {
    @IsNotEmpty()
    @IsString()
    name!: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNotEmpty()
    @IsString()
    @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Invalid card ID format' })
    cardId!: string;

    @IsNotEmpty()
    @IsString()
    @Matches(/^[0-9a-fA-F]{24}$/, { message: 'Invalid project ID format' })
    projectId!: string;

    @IsOptional()
    @IsString()
    assignedTo?: string | null;
}
