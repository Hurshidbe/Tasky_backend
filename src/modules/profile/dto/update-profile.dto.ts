import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional, IsString, IsUrl, Length, Matches } from 'class-validator';

export class ProfileDto {
    @IsOptional()
    @IsString()
    @Length(2, 50)
    firstname?: string

    @IsOptional()
    @IsString()
    @Length(2, 50)
    lastname?: string

    @IsOptional()
    @IsString()
    @Length(2, 100)
    profession?: string

    @IsOptional()
    @IsString()
    @Matches(/^[a-zA-Z0-9_]+$/)
    @Length(4, 16)
    username?: string

    @IsOptional()
    @IsString()
    @Length(0, 1000)
    about?: string

    @IsOptional()
    @IsUrl()
    avatar?: string
}
