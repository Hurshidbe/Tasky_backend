import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ColumnDocument = Column & Document;

@Schema({ timestamps: true, collection: 'cards' })
export class Column {
  @Prop({ required: true })
  title!: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId!: Types.ObjectId;

  @Prop({ default: 0 })
  order!: number;
}

export const ColumnSchema = SchemaFactory.createForClass(Column);

// Backward-compatible alias
export { Column as Card };
export { ColumnSchema as CardSchema };
export type CardDocument = ColumnDocument;
