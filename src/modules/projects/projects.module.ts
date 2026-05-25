import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsGateway } from './projects.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from './entities/project.entity';
import { Activity, ActivitySchema } from './entities/activity.entity';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { MailModule } from '../nodeMailer/mailer.module';
import { Auth, AuthSchema } from '../auth/schema/auth.schema';
import { Card, CardSchema } from '../cards/entities/card.entity';
import { Task, TaskSchema } from '../cards/entities/task.entity';
import * as dotenv from 'dotenv'
import { ProjectsController } from './projects.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
dotenv.config()

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Auth.name, schema: AuthSchema },
      { name: Card.name, schema: CardSchema },
      { name: Task.name, schema: TaskSchema },
      { name: Activity.name, schema: ActivitySchema }
    ]),
    MailModule,
    CloudinaryModule
  ],
  controllers: [ProjectsController],
  providers: [ProjectsGateway, ProjectsService],
})
export class ProjectsModule { }
