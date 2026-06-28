import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TaskMovementDocument = TaskMovement & Document;

@Schema({ timestamps: true, collection: 'taskmovements' })
export class TaskMovement {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  action!: string; // 'created', 'moved', 'assigned', 'updated'

  @Prop({ type: Types.ObjectId, ref: 'Column', index: true })
  fromCard?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Column', index: true })
  toCard?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) // Point to User
  by!: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  at!: Date;
}

export const TaskMovementSchema = SchemaFactory.createForClass(TaskMovement);
