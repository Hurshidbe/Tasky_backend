import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseFilters, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Socket, Server } from 'socket.io';

import { ColumnService } from './services/column.service.js';
import { TaskService } from './services/task.service.js';
import { BoardService } from './services/board.service.js';
import { CreateCardDto } from './dto/create-card.dto.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { MoveTaskDto } from './dto/move-task.dto.js';
import { UpdateCardDto } from './dto/update-card.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { JoinProjectDto } from './dto/join-project.dto.js';
import { GetBoardDto } from './dto/get-board.dto.js';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter.js';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard.js';

@WebSocketGateway({ cors: { origin: '*' } })
@UseFilters(WsExceptionFilter)
@UseGuards(WsAuthGuard)
export class BoardGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly columnService: ColumnService,
    private readonly taskService: TaskService,
    private readonly boardService: BoardService,
  ) {}

  private async broadcastActivities(projectId: string) {
    try {
      const activities = await this.boardService.getActivities(projectId);
      this.server.to(`project_${projectId}`).emit('activitiesUpdated', { activities });
    } catch (e) {
      // Broadcast failure is non-critical
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('joinProject')
  async handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinProjectDto,
  ) {
    try {
      const userId = client.data.user.userId;
      await this.taskService.validateProjectAccess(userId, dto.projectId);
      client.join(`project_${dto.projectId}`);
      return { success: true, message: `Joined project room: project_${dto.projectId}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('createCard')
  async handleCreateCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateCardDto,
  ) {
    try {
      const userId = client.data.user.userId;
      const card = await this.columnService.createColumn(userId, dto);

      this.server.to(`project_${dto.projectId}`).emit('cardCreated', card);
      this.broadcastActivities(dto.projectId);
      return { success: true, data: card };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('updateCard')
  async handleUpdateCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: UpdateCardDto,
  ) {
    try {
      const userId = client.data.user.userId;
      const { id, ...updateData } = dto;
      const card = await this.columnService.updateColumn(userId, id, updateData);

      this.server.to(`project_${card.projectId}`).emit('cardUpdated', card);
      this.broadcastActivities(card.projectId.toString());
      return { success: true, data: card };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('removeCard')
  async handleRemoveCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id: string },
  ) {
    try {
      const userId = client.data.user.userId;
      const result = await this.columnService.removeColumn(userId, data.id);

      this.server.to(`project_${result.projectId}`).emit('cardRemoved', { cardId: data.id });
      this.broadcastActivities(result.projectId.toString());
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('reorderCards')
  async handleReorderCards(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; cardIds: string[] },
  ) {
    try {
      const userId = client.data.user.userId;
      await this.taskService.validateProjectAccess(userId, data.projectId);

      await Promise.all(
        data.cardIds.map((cardId, index) =>
          this.columnService.updateColumn(userId, cardId, { order: index }),
        ),
      );

      this.server.to(`project_${data.projectId}`).emit('cardReordered', { success: true });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('createTask')
  async handleCreateTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateTaskDto,
  ) {
    try {
      const userId = client.data.user.userId;
      const task = await this.taskService.createTask(userId, dto);

      this.server.to(`project_${dto.projectId}`).emit('taskCreated', task);
      this.broadcastActivities(dto.projectId);
      return { success: true, data: task };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('updateTask')
  async handleUpdateTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: UpdateTaskDto,
  ) {
    try {
      const userId = client.data.user.userId;
      const { id, ...updateData } = dto;
      const task = await this.taskService.updateTask(userId, id as string, updateData);

      this.server.to(`project_${task.projectId}`).emit('taskUpdated', task);
      this.broadcastActivities(task.projectId.toString());
      return { success: true, data: task };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('removeTask')
  async handleRemoveTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id: string },
  ) {
    try {
      const userId = client.data.user.userId;
      const result = await this.taskService.removeTask(userId, data.id);

      this.server.to(`project_${result.projectId}`).emit('taskRemoved', { taskId: data.id });
      this.broadcastActivities(result.projectId.toString());
      return { success: true, ...result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('moveTask')
  async handleMoveTask(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: MoveTaskDto,
  ) {
    try {
      const userId = client.data.user.userId;
      const result = await this.taskService.moveTask(userId, dto);

      const projectId =
        result.destinationTasks[0]?.projectId?.toString() ||
        result.sourceTasks[0]?.projectId?.toString();

      this.server.to(`project_${projectId}`).emit('taskMoved', {
        fromColumnId: dto.fromColumnId,
        toColumnId: dto.toColumnId,
        updatedSourceColumnTasks: result.sourceTasks,
        updatedTargetColumnTasks: result.destinationTasks,
      });

      this.broadcastActivities(projectId);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('getBoard')
  async handleGetBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: GetBoardDto,
  ) {
    try {
      const userId = client.data.user.userId;
      const board = await this.boardService.getBoard(userId, dto.projectId);
      return { success: true, data: board };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
