import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ProjectService } from './project.service.js';
import { ProjectGateway } from './project.gateway.js';
import { ProjectController } from './project.controller.js';
import { Project, ProjectSchema } from './schemas/project.schema.js';
import { Activity, ActivitySchema } from './schemas/activity.schema.js';
import { User, UserSchema } from '../auth/schema/auth.schema.js';
import { Column, ColumnSchema } from '../board/schemas/column.schema.js';
import { Task, TaskSchema } from '../board/schemas/task.schema.js';
import { MailModule } from '../mail/mail.module.js';
import { CloudinaryModule } from '../cloudinary/cloudinary.module.js';
import { ActivityLoggerService } from '../../common/services/activity-logger.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
      { name: Column.name, schema: ColumnSchema },
      { name: Task.name, schema: TaskSchema },
      { name: Activity.name, schema: ActivitySchema },
    ]),
    MailModule,
    CloudinaryModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectGateway, ProjectService, ActivityLoggerService],
  exports: [ProjectService],
})
export class ProjectModule {}
