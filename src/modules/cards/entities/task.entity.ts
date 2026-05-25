import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TaskDocument = Task & Document;

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Card', required: true, index: true })
  cardId: Types.ObjectId; // Current column

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  projectId: Types.ObjectId;


  @Prop({ type: String, default: '500000', index: true })
  order: string; // LexoRank rank value inside column

  @Prop({
    type: [{
      action: { type: String }, // 'created', 'moved', 'assigned'
      fromCard: { type: Types.ObjectId, ref: 'Card' },
      toCard: { type: Types.ObjectId, ref: 'Card' },
      by: { type: Types.ObjectId, ref: 'Auth' },
      at: { type: Date, default: Date.now }
    }],
    select: false,
    default: []
  })
  history: any[];
}

export const TaskSchema = SchemaFactory.createForClass(Task);
