import { Injectable, NotFoundException, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Card, CardDocument } from './entities/card.entity';
import { Task, TaskDocument } from './entities/task.entity';
import { TaskMovement, TaskMovementDocument } from './entities/task-movement.entity';
import { Project } from '../projects/entities/project.entity';
import { Auth } from '../auth/schema/auth.schema';
import { Activity, ActivityDocument } from '../projects/entities/activity.entity';
import { CreateCardDto } from './dto/create-card.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { LexoRank } from '../../shared/lexorank';

@Injectable()
export class CardsService {
  constructor(
    @InjectModel(Card.name) private readonly CardRepo: Model<CardDocument>,
    @InjectModel(Task.name) private readonly TaskRepo: Model<TaskDocument>,
    @InjectModel(TaskMovement.name) private readonly TaskMovementRepo: Model<TaskMovementDocument>,
    @InjectModel(Project.name) private readonly ProjectRepo: Model<Project>,
    @InjectModel(Auth.name) private readonly AuthRepo: Model<Auth>,
    @InjectModel(Activity.name) private readonly ActivityRepo: Model<ActivityDocument>,
    private readonly jwt: JwtService
  ) { }

  async logActivity(projectId: string, userId: string, type: string, details: Partial<Activity> = {}) {
    try {
      const user = await this.AuthRepo.findById(userId).exec();
      const userName = user ? `${user.firstname} ${user.lastname || ''}`.trim() : 'Someone';
      const userAvatar = user?.avatar;

      return await this.ActivityRepo.create({
        projectId: new Types.ObjectId(projectId),
        userId: new Types.ObjectId(userId),
        type,
        userName,
        userAvatar,
        ...details
      });
    } catch (e) {
      console.error('Failed to log activity:', e);
    }
  }

  async validateProjectAccess(userId: string, projectId: string) {
    const project = await this.ProjectRepo.findById(projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    const isOwner = project.owner.toString() === userId;
    const isCollaborator = (project.collaborators?.some(id => id.toString() === userId)) ||
                           (project.collobrators?.some(id => id.toString() === userId));

    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project');
    }
    return project;
  }

  async createCard(userId: string, dto: CreateCardDto) {
    const project = await this.ProjectRepo.findById(dto.projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    // Only owner can create cards (columns)
    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the project owner can create cards (columns)');
    }

    // Check for duplicate card title in the same project
    const existingCard = await this.CardRepo.findOne({
      projectId: new Types.ObjectId(dto.projectId),
      title: dto.title
    }).exec();

    if (existingCard) {
      throw new BadRequestException(`Card with title "${dto.title}" already exists in this project`);
    }

    // Auto-calculate next order
    const lastCard = await this.CardRepo.findOne({
      projectId: new Types.ObjectId(dto.projectId)
    }).sort({ order: -1 }).exec();
    const nextOrder = lastCard ? lastCard.order + 1 : 0;

    const card = await this.CardRepo.create({
      title: dto.title,
      projectId: new Types.ObjectId(dto.projectId),
      order: nextOrder
    });

    await this.logActivity(dto.projectId, userId, 'column_created', {
      cardId: card._id as any,
      data: { title: dto.title }
    });

    return card;
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    const project = await this.ProjectRepo.findById(dto.projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    // Check if user is owner or collaborator
    const isOwner = project.owner.toString() === userId;
    const isCollaborator = project.collobrators?.some(id => id.toString() === userId) ||
                           project.collaborators?.some(id => id.toString() === userId);
    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const card = await this.CardRepo.findById(dto.cardId).exec();
    if (!card) throw new NotFoundException('Target card (column) not found');
    
    // Strict relational integrity validation
    if (card.projectId.toString() !== dto.projectId) {
      throw new ForbiddenException('The column does not belong to this project');
    }

    // Alphanumeric LexoRank rank calculation (O(1) infinite insertion ordering)
    const lastTask = await this.TaskRepo.findOne({
      cardId: new Types.ObjectId(dto.cardId)
    }).sort({ order: -1 }).exec();
    const nextOrder = lastTask ? LexoRank.calculate(lastTask.order, undefined) : '500000';

    const task = await this.TaskRepo.create({
      name: dto.name,
      description: dto.description,
      cardId: new Types.ObjectId(dto.cardId),
      projectId: new Types.ObjectId(dto.projectId),
      order: nextOrder,
    });

    await this.TaskMovementRepo.create({
      taskId: task._id as any,
      action: 'created',
      toCard: new Types.ObjectId(dto.cardId),
      by: new Types.ObjectId(userId),
      at: new Date()
    });

    await this.logActivity(dto.projectId, userId, 'task_created', {
      taskId: task._id as any,
      taskName: dto.name,
      cardId: new Types.ObjectId(dto.cardId)
    });

    return task;
  }

  async moveTaskBetweenColumns(
    userId: string,
    dto: {
      taskId: string;
      fromColumnId?: string;
      toColumnId: string;
      newIndex?: number;
    }
  ): Promise<{ sourceTasks: any[]; destinationTasks: any[] }> {
    const { taskId, toColumnId, newIndex } = dto;

    const task = await this.TaskRepo.findById(taskId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const project = await this.ProjectRepo.findById(task.projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Consolidated access validation
    const isOwner = project.owner.toString() === userId;
    const isCollaborator = project.collobrators?.some(id => id.toString() === userId) ||
                           project.collaborators?.some(id => id.toString() === userId);
    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access');
    }

    const sourceColumnId = task.cardId.toString();

    // Strict relational integrity validation (project-card matching)
    const targetCard = await this.CardRepo.findById(toColumnId);
    if (!targetCard) {
      throw new NotFoundException('Target column not found');
    }
    if (targetCard.projectId.toString() !== task.projectId.toString()) {
      throw new ForbiddenException('The column does not belong to this project');
    }

    // 1. Fetch destination tasks sorted by order ascending, excluding the moving task itself
    const destTasks = await this.TaskRepo.find({
      cardId: new Types.ObjectId(toColumnId),
      _id: { $ne: task._id }
    }).sort({ order: 1 }).exec();

    let newOrder: string;

    if (destTasks.length === 0) {
      // Column is empty
      newOrder = '500000';
    } else if (typeof newIndex !== 'number' || newIndex >= destTasks.length) {
      // Drop at the very bottom
      const lastTask = destTasks[destTasks.length - 1];
      newOrder = LexoRank.calculate(lastTask.order, undefined);
    } else if (newIndex <= 0) {
      // Drop at the very top
      const firstTask = destTasks[0];
      newOrder = LexoRank.calculate(undefined, firstTask.order);
    } else {
      // Drop in between two existing tasks
      const prevTask = destTasks[newIndex - 1];
      const nextTask = destTasks[newIndex];
      newOrder = LexoRank.calculate(prevTask.order, nextTask.order);
    }

    // 2. Atomically update the target task document (O(1) database write)
    const updatedTask = await this.TaskRepo.findByIdAndUpdate(
      taskId,
      { cardId: new Types.ObjectId(toColumnId), order: newOrder },
      { new: true }
    ).exec();

    if (!updatedTask) {
      throw new NotFoundException('Failed to update task');
    }

    // 3. Write movement history to the dedicated TaskMovement collection (fully decoupled)
    await this.TaskMovementRepo.create({
      taskId: new Types.ObjectId(taskId),
      action: 'moved',
      fromCard: new Types.ObjectId(sourceColumnId),
      toCard: new Types.ObjectId(toColumnId),
      by: new Types.ObjectId(userId),
      at: new Date()
    });

    // 4. Log the general activity
    await this.logActivity(task.projectId.toString(), userId, 'task_moved', {
      taskId: task._id as any,
      taskName: task.name,
      fromCard: new Types.ObjectId(sourceColumnId),
      toCard: new Types.ObjectId(toColumnId)
    });

    // 5. Fetch updated source and target columns for websocket synchronization
    const updatedSource = await this.TaskRepo.find({ cardId: new Types.ObjectId(sourceColumnId) }).sort({ order: 1 });
    const updatedDest = await this.TaskRepo.find({ cardId: new Types.ObjectId(toColumnId) }).sort({ order: 1 });

    return { sourceTasks: updatedSource, destinationTasks: updatedDest };
  }

  async moveTask(userId: string, dto: MoveTaskDto) {
    console.log('moveTask called with dto', dto);

    const result = await this.moveTaskBetweenColumns(userId, {
      taskId: dto.taskId,
      fromColumnId: dto.fromColumnId,
      toColumnId: dto.toColumnId,
      newIndex: dto.newIndex,
    });
    console.log('moveTask result', result);
    return result;
  }

  async getTaskHistory(userId: string, taskId: string) {
    const task = await this.TaskRepo.findById(taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    await this.validateProjectAccess(userId, task.projectId.toString());

    return await this.TaskMovementRepo.find({ taskId: new Types.ObjectId(taskId) })
      .populate('by', 'firstname lastname email avatar')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateCard(userId: string, cardId: string, dto: any) {
    const card = await this.CardRepo.findById(cardId).exec();
    if (!card) throw new NotFoundException('Card not found');

    const project = await this.ProjectRepo.findById(card.projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the project owner can update cards (columns)');
    }

    if (dto.title) {
      const existing = await this.CardRepo.findOne({
        projectId: card.projectId,
        title: dto.title,
        _id: { $ne: card._id }
      }).exec();
      if (existing) throw new BadRequestException(`Card with title "${dto.title}" already exists`);
    }

    const updated = await this.CardRepo.findByIdAndUpdate(cardId, dto, { returnDocument: 'after' }).exec();
    if (!updated) throw new NotFoundException('Card not found after update');

    if (dto.title && card.title !== dto.title) {
      await this.logActivity(card.projectId.toString(), userId, 'column_renamed', {
        cardId: card._id as any,
        data: { oldTitle: card.title, newTitle: dto.title }
      });
    }

    return updated;
  }

  async removeCard(userId: string, cardId: string) {
    const card = await this.CardRepo.findById(cardId).exec();
    if (!card) throw new NotFoundException('Card not found');

    const project = await this.ProjectRepo.findById(card.projectId).exec();
    if (!project || project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the project owner can delete cards');
    }

    // Cascade delete: Remove all tasks in this card
    await this.TaskRepo.deleteMany({ cardId: new Types.ObjectId(cardId) }).exec();

    await this.logActivity(card.projectId.toString(), userId, 'column_deleted', {
      cardId: card._id as any,
      data: { title: card.title }
    });

    await this.CardRepo.findByIdAndDelete(cardId).exec();

    return { cardId, projectId: card.projectId };
  }

  async updateTask(userId: string, taskId: string, dto: any) {
    const task = await this.TaskRepo.findById(taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    const project = await this.ProjectRepo.findById(task.projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    const isOwner = project.owner.toString() === userId;
    const isCollaborator = (project.collaborators?.some(id => id.toString() === userId)) ||
                           (project.collobrators?.some(id => id.toString() === userId));
    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project');
    }

    await this.TaskMovementRepo.create({
      taskId: task._id as any,
      action: 'updated',
      by: new Types.ObjectId(userId),
      at: new Date()
    });

    const updated = await this.TaskRepo.findByIdAndUpdate(taskId, dto, { returnDocument: 'after' }).exec();
    if (!updated) throw new NotFoundException('Task not found after update');

    await this.logActivity(task.projectId.toString(), userId, 'task_updated', {
      taskId: task._id as any,
      taskName: task.name,
      cardId: task.cardId
    });

    return updated;
  }

  async removeTask(userId: string, taskId: string) {
    const task = await this.TaskRepo.findById(taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    const project = await this.ProjectRepo.findById(task.projectId).exec();
    if (!project || project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the project owner can delete tasks');
    }

    await this.logActivity(task.projectId.toString(), userId, 'task_deleted', {
      taskId: task._id as any,
      taskName: task.name,
      cardId: task.cardId
    });

    await this.TaskRepo.findByIdAndDelete(taskId).exec();
    return { taskId, projectId: task.projectId };
  }

  async getBoard(userId: string, projectId: string) {
    const project = await this.ProjectRepo.findById(projectId)
      .populate('owner', 'firstname lastname email avatar username profession about createdAt')
      .populate('collaborators', 'firstname lastname email avatar username profession about createdAt')
      .populate('collobrators', 'firstname lastname email avatar username profession about createdAt')
      .exec();
    if (!project) throw new NotFoundException('Project not found');

    const isOwner = (project.owner as any)['_id']?.toString() === userId;
    const isCollaborator = (project.collaborators as any[])?.some(c => c['_id']?.toString() === userId) ||
                           (project.collobrators as any[])?.some(c => c['_id']?.toString() === userId);
    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const cards = await this.CardRepo.find({ projectId: new Types.ObjectId(projectId) })
      .sort({ order: 1 })
      .exec();

    const tasksQuery = this.TaskRepo.find({ projectId: new Types.ObjectId(projectId) })
      .sort({ cardId: 1, order: 1 });
    if (isOwner) tasksQuery.select('+history');
    const tasks = await tasksQuery.exec();

    // Loyihaning barcha faoliyatlari (activities)ni tortib olamiz
    const activities = await this.ActivityRepo.find({ projectId: new Types.ObjectId(projectId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();

    // Debug logs
    console.log('CARDS:', cards.map(c => ({ id: c._id.toString(), title: c.title })));
    console.log('TASKS:', tasks.map(t => ({
      id: t._id.toString(),
      title: t.name,
      cardId: t.cardId?.toString(),
      order: t.order,
    })));

    // Return cards, tasks, project and activities
    return { cards, tasks, project, activities };
  }

  async getActivities(projectId: string) {
    return await this.ActivityRepo.find({ projectId: new Types.ObjectId(projectId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }

  async tokenChecker(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers.authorization;
      if (!token) throw new Error('token not found');

      const payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET });
      client.data.user = payload;
      return payload;
    } catch (error) {
      throw new UnauthorizedException(error.message);
    }
  }
}



