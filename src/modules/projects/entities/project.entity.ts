import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({ timestamps: true })
export class Project {
    @Prop()
    name!: string

    @Prop({ required: false })
    project_icon?: string

    @Prop({ type: Types.ObjectId, ref: 'Auth', required: true, index: true })
    owner!: Types.ObjectId

    @Prop({ required: false })
    description?: string

    @Prop({ required: false })
    background?: string

    @Prop({ type: [{ type: Types.ObjectId, ref: 'Auth' }], default: [], index: true })
    collaborators?: string[]
}

export const ProjectSchema = SchemaFactory.createForClass(Project)