import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * User schema (previously named "Auth").
 * Collection name is preserved as 'auths' to avoid breaking existing data.
 */
@Schema({ timestamps: true, collection: 'auths' })
export class User {
  @Prop({ required: true })
  email!: string;

  @Prop({ required: true })
  firstname!: string;

  @Prop({ type: String, required: false })
  password?: string | null;

  @Prop({ required: false })
  lastname?: string;

  @Prop({ required: false })
  profession?: string;

  @Prop({ required: false })
  username?: string;

  @Prop({ default: '', required: false })
  about?: string;

  @Prop({ required: false, default: null })
  avatar?: string;

  @Prop({ default: false })
  is_email_verified?: boolean;

  @Prop({ required: false, default: null })
  google_id?: string;

  @Prop({ required: false, default: false })
  is_blocked_user!: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

/**
 * Backward-compatible aliases for gradual migration.
 * Existing modules can import either Auth or User.
 */
export { User as Auth };
export { UserSchema as AuthSchema };