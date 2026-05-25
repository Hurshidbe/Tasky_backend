import { Module } from '@nestjs/common';
import { CardsService } from './cards.service';
import { CardsGateway } from './cards.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { Card, CardSchema } from './entities/card.entity';
import { Task, TaskSchema } from './entities/task.entity';
import { TaskMovement, TaskMovementSchema } from './entities/task-movement.entity';
import { Project, ProjectSchema } from '../projects/entities/project.entity';
import { Auth, AuthSchema } from '../auth/schema/auth.schema';
import { Activity, ActivitySchema } from '../projects/entities/activity.entity';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Card.name, schema: CardSchema },
      { name: Task.name, schema: TaskSchema },
      { name: TaskMovement.name, schema: TaskMovementSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: Auth.name, schema: AuthSchema },
      { name: Activity.name, schema: ActivitySchema }
    ])
  ],
  providers: [CardsGateway, CardsService],
})
export class CardsModule {}
