import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TaskMovementDocument = TaskMovement & Document;

@Schema({ timestamps: true })
export class TaskMovement {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  action!: string; // 'created', 'moved', 'assigned', 'updated'

  @Prop({ type: Types.ObjectId, ref: 'Card', index: true })
  fromCard?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Card', index: true })
  toCard?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Auth', required: true, index: true })
  by!: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  at!: Date;
}

export const TaskMovementSchema = SchemaFactory.createForClass(TaskMovement);
