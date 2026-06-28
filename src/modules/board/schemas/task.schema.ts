import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TaskDocument = Task & Document;

@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  @Prop({ required: true })
  name!: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Column', required: true, index: true })
  cardId!: Types.ObjectId; // Keep as cardId in DB for API compatibility (refers to Column)

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId!: Types.ObjectId;

  @Prop({ type: String, default: '500000', index: true })
  order!: string; // LexoRank value

  @Prop({
    type: [{
      action: { type: String },
      fromCard: { type: Types.ObjectId, ref: 'Column' },
      toCard: { type: Types.ObjectId, ref: 'Column' },
      by: { type: Types.ObjectId, ref: 'User' }, // Point to User (formerly Auth)
      at: { type: Date, default: Date.now }
    }],
    select: false,
    default: []
  })
  history!: any[];
}

export const TaskSchema = SchemaFactory.createForClass(Task);
