import { IsEmail, IsNotEmpty, IsString, IsStrongPassword, Length, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @Length(5, 100)
  @IsEmail()
  email!: string;

  @MaxLength(50)
  @IsStrongPassword({
    minLength: 6,
    minNumbers: 1,
    minUppercase: 1,
  })
  password!: string;

  @MaxLength(50)
  @IsStrongPassword({
    minLength: 6,
    minNumbers: 1,
    minUppercase: 1,
  })
  return_password!: string;
}