import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument } from '../schemas/task.schema.js';
import { Column, ColumnDocument } from '../schemas/column.schema.js';
import { TaskMovement, TaskMovementDocument } from '../schemas/task-movement.schema.js';
import { Project } from '../../project/schemas/project.schema.js';
import { CreateTaskDto } from '../dto/create-task.dto.js';
import { MoveTaskDto } from '../dto/move-task.dto.js';
import { LexoRank } from '../../../common/utils/lexorank.js';
import { ActivityLoggerService } from '../../../common/services/activity-logger.service.js';

@Injectable()
export class TaskService {
  constructor(
    @InjectModel(Task.name) private readonly taskRepo: Model<TaskDocument>,
    @InjectModel(Column.name) private readonly columnRepo: Model<ColumnDocument>,
    @InjectModel(TaskMovement.name) private readonly taskMovementRepo: Model<TaskMovementDocument>,
    @InjectModel(Project.name) private readonly projectRepo: Model<Project>,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  async validateProjectAccess(userId: string, projectId: string) {
    const project = await this.projectRepo.findById(projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    const isOwner = project.owner.toString() === userId;
    const isCollaborator = project.collaborators?.some((id) => id.toString() === userId);

    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project');
    }
    return project;
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    const project = await this.projectRepo.findById(dto.projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the project owner can create tasks');
    }

    const column = await this.columnRepo.findById(dto.cardId).exec();
    if (!column) throw new NotFoundException('Target column not found');

    if (column.projectId.toString() !== dto.projectId) {
      throw new ForbiddenException('The column does not belong to this project');
    }

    const lastTask = await this.taskRepo
      .findOne({ cardId: new Types.ObjectId(dto.cardId) })
      .sort({ order: -1 })
      .exec();
    const nextOrder = lastTask
      ? LexoRank.calculate(lastTask.order, undefined)
      : LexoRank.initialRank;

    const task = await this.taskRepo.create({
      name: dto.name,
      description: dto.description,
      cardId: new Types.ObjectId(dto.cardId),
      projectId: new Types.ObjectId(dto.projectId),
      order: nextOrder,
    });

    await this.taskMovementRepo.create({
      taskId: task._id as any,
      action: 'created',
      toCard: new Types.ObjectId(dto.cardId),
      by: new Types.ObjectId(userId),
      at: new Date(),
    });

    await this.activityLogger.log(dto.projectId, userId, 'task_created', {
      taskId: task._id as any,
      taskName: dto.name,
      cardId: new Types.ObjectId(dto.cardId),
    });

    return this.taskRepo.findById(task._id).exec();
  }

  async updateTask(userId: string, taskId: string, dto: any) {
    const task = await this.taskRepo.findById(taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    const project = await this.projectRepo.findById(task.projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    const isOwner = project.owner.toString() === userId;
    const isCollaborator = project.collaborators?.some((id) => id.toString() === userId);
    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project');
    }

    await this.taskMovementRepo.create({
      taskId: task._id as any,
      action: 'updated',
      by: new Types.ObjectId(userId),
      at: new Date(),
    });

    const updated = await this.taskRepo
      .findByIdAndUpdate(taskId, dto, { returnDocument: 'after' })
      .exec();
    if (!updated) throw new NotFoundException('Task not found after update');

    await this.activityLogger.log(task.projectId.toString(), userId, 'task_updated', {
      taskId: task._id as any,
      taskName: task.name,
      cardId: task.cardId,
    });

    return updated;
  }

  async removeTask(userId: string, taskId: string) {
    const task = await this.taskRepo.findById(taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    const project = await this.projectRepo.findById(task.projectId).exec();
    if (!project || project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the project owner can delete tasks');
    }

    await this.activityLogger.log(task.projectId.toString(), userId, 'task_deleted', {
      taskId: task._id as any,
      taskName: task.name,
      cardId: task.cardId,
    });

    await this.taskRepo.findByIdAndDelete(taskId).exec();
    return { taskId, projectId: task.projectId };
  }

  async moveTask(userId: string, dto: MoveTaskDto) {
    return this.moveTaskBetweenColumns(userId, {
      taskId: dto.taskId,
      fromColumnId: dto.fromColumnId,
      toColumnId: dto.toColumnId,
      newIndex: dto.newIndex,
    });
  }

  async moveTaskBetweenColumns(
    userId: string,
    dto: {
      taskId: string;
      fromColumnId?: string;
      toColumnId: string;
      newIndex?: number;
    },
  ): Promise<{ sourceTasks: any[]; destinationTasks: any[] }> {
    const { taskId, toColumnId, newIndex } = dto;

    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new NotFoundException('Task not found');

    const project = await this.projectRepo.findById(task.projectId);
    if (!project) throw new NotFoundException('Project not found');

    const isOwner = project.owner.toString() === userId;
    const isCollaborator = project.collaborators?.some((id) => id.toString() === userId);
    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access');
    }

    const sourceColumnId = task.cardId.toString();

    const targetColumn = await this.columnRepo.findById(toColumnId);
    if (!targetColumn) throw new NotFoundException('Target column not found');

    if (targetColumn.projectId.toString() !== task.projectId.toString()) {
      throw new ForbiddenException('The column does not belong to this project');
    }

    const destTasks = await this.taskRepo
      .find({
        cardId: new Types.ObjectId(toColumnId),
        _id: { $ne: task._id },
      })
      .sort({ order: 1 })
      .exec();

    let newOrder: string;

    if (destTasks.length === 0) {
      newOrder = LexoRank.initialRank;
    } else if (typeof newIndex !== 'number' || newIndex >= destTasks.length) {
      const lastTask = destTasks[destTasks.length - 1];
      newOrder = LexoRank.calculate(lastTask.order, undefined);
    } else if (newIndex <= 0) {
      const firstTask = destTasks[0];
      newOrder = LexoRank.calculate(undefined, firstTask.order);
    } else {
      const prevTask = destTasks[newIndex - 1];
      const nextTask = destTasks[newIndex];
      newOrder = LexoRank.calculate(prevTask.order, nextTask.order);
    }

    const updatedTask = await this.taskRepo
      .findByIdAndUpdate(
        taskId,
        { cardId: new Types.ObjectId(toColumnId), order: newOrder },
        { new: true },
      )
      .exec();

    if (!updatedTask) throw new NotFoundException('Failed to update task');

    await this.taskMovementRepo.create({
      taskId: new Types.ObjectId(taskId),
      action: 'moved',
      fromCard: new Types.ObjectId(sourceColumnId),
      toCard: new Types.ObjectId(toColumnId),
      by: new Types.ObjectId(userId),
      at: new Date(),
    });

    await this.activityLogger.log(task.projectId.toString(), userId, 'task_moved', {
      taskId: task._id as any,
      taskName: task.name,
      fromCard: new Types.ObjectId(sourceColumnId),
      toCard: new Types.ObjectId(toColumnId),
    });

    const updatedSource = await this.taskRepo
      .find({ cardId: new Types.ObjectId(sourceColumnId) })
      .sort({ order: 1 });
    const updatedDest = await this.taskRepo
      .find({ cardId: new Types.ObjectId(toColumnId) })
      .sort({ order: 1 });

    return { sourceTasks: updatedSource, destinationTasks: updatedDest };
  }

  async getTaskHistory(userId: string, taskId: string) {
    const task = await this.taskRepo.findById(taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    await this.validateProjectAccess(userId, task.projectId.toString());

    return this.taskMovementRepo
      .find({ taskId: new Types.ObjectId(taskId) })
      .populate('by', 'firstname lastname email avatar')
      .sort({ createdAt: -1 })
      .exec();
  }
}
