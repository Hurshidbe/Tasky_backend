import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Types } from "mongoose";

@Schema({ timestamps: true, collection: 'projects' })
export class Project {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: false })
  project_icon?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  owner!: Types.ObjectId;

  @Prop({ required: false })
  description?: string;

  @Prop({ required: false })
  background?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [], index: true })
  collaborators!: string[];
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
