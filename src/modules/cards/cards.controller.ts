import { Body, Controller, HttpException, HttpStatus, Put, Req } from '@nestjs/common';
import { CardsService } from './cards.service';
import { MoveTaskDto } from './dto/move-task.dto';
import { CardsGateway } from './cards.gateway';

@Controller('tasks')
export class CardsController {
  constructor(
    private readonly cardsService: CardsService,
    private readonly gateway: CardsGateway,
  ) {}

  @Put('move')
async moveTask(
  @Req() req: any,
  @Body() dto: MoveTaskDto
) {
  if (!dto.taskId || !dto.toColumnId) {
    throw new HttpException(
      'Missing required fields',
      HttpStatus.BAD_REQUEST
    );
  }

  try {
    const result = await this.cardsService.moveTaskBetweenColumns(
      req.user.id,
      {
        taskId: dto.taskId,
        fromColumnId: dto.fromColumnId,
        toColumnId: dto.toColumnId,
        newIndex: dto.newIndex,
      }
    );

    this.gateway.server.emit('taskMoved', {
      fromColumnId: dto.fromColumnId,
      toColumnId: dto.toColumnId,
      updatedSourceColumnTasks: result.sourceTasks,
      updatedTargetColumnTasks: result.destinationTasks,
    });

    return {
      success: true,
      data: result
    };

  } catch (err) {
    throw new HttpException(
      err?.message || 'Task move failed',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
}