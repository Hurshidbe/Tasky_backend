import { Controller, Body, Put, UseGuards } from '@nestjs/common';
import { TaskService } from './services/task.service.js';
import { BoardGateway } from './board.gateway.js';
import { MoveTaskDto } from './dto/move-task.dto.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@UseGuards(AuthGuard)
@Controller('tasks')
export class BoardController {
  constructor(
    private readonly taskService: TaskService,
    private readonly gateway: BoardGateway,
  ) {}

  @Put('move')
  async moveTask(@CurrentUser() userId: string, @Body() dto: MoveTaskDto) {
    const result = await this.taskService.moveTaskBetweenColumns(userId, {
      taskId: dto.taskId,
      fromColumnId: dto.fromColumnId,
      toColumnId: dto.toColumnId,
      newIndex: dto.newIndex,
    });

    this.gateway.server.emit('taskMoved', {
      fromColumnId: dto.fromColumnId,
      toColumnId: dto.toColumnId,
      updatedSourceColumnTasks: result.sourceTasks,
      updatedTargetColumnTasks: result.destinationTasks,
    });

    return { success: true, data: result };
  }
}
