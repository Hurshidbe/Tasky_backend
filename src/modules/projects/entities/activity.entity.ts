import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types, Document } from "mongoose";

export type ActivityDocument = Activity & Document;

@Schema({ timestamps: true })
export class Activity {
    @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
    projectId!: Types.ObjectId;

    @Prop({ required: true })
    type!: string; // 'task_created', 'task_moved', 'user_joined', etc.

    @Prop({ type: Types.ObjectId, ref: 'Auth', required: true })
    userId!: Types.ObjectId;

    @Prop()
    userName?: string;

    @Prop()
    userAvatar?: string;

    @Prop()
    taskName?: string;

    @Prop({ type: Types.ObjectId })
    taskId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId })
    cardId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId })
    fromCard?: Types.ObjectId;

    @Prop({ type: Types.ObjectId })
    toCard?: Types.ObjectId;

    @Prop({ type: Object, default: {} })
    data?: any;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
