import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { BoardGateway } from './board.gateway.js';
import { BoardController } from './board.controller.js';
import { ColumnService } from './services/column.service.js';
import { TaskService } from './services/task.service.js';
import { BoardService } from './services/board.service.js';
import { Column, ColumnSchema } from './schemas/column.schema.js';
import { Task, TaskSchema } from './schemas/task.schema.js';
import { TaskMovement, TaskMovementSchema } from './schemas/task-movement.schema.js';
import { Project, ProjectSchema } from '../project/schemas/project.schema.js';
import { User, UserSchema } from '../auth/schema/auth.schema.js';
import { Activity, ActivitySchema } from '../project/schemas/activity.schema.js';
import { ActivityLoggerService } from '../../common/services/activity-logger.service.js';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Column.name, schema: ColumnSchema },
      { name: Task.name, schema: TaskSchema },
      { name: TaskMovement.name, schema: TaskMovementSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
      { name: Activity.name, schema: ActivitySchema },
    ]),
  ],
  controllers: [BoardController],
  providers: [
    BoardGateway,
    ColumnService,
    TaskService,
    BoardService,
    ActivityLoggerService,
    WsAuthGuard,
  ],
  exports: [ColumnService, TaskService, BoardService],
})
export class BoardModule {}
