import { Injectable, NotFoundException, ForbiddenException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Card, CardDocument } from './entities/card.entity';
import { Task, TaskDocument } from './entities/task.entity';
import { Project } from '../projects/entities/project.entity';
import { Auth } from '../auth/schema/auth.schema';
import { CreateCardDto } from './dto/create-card.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { MoveTaskDto } from './dto/move-task.dto';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateCardDto } from './dto/update-card.dto';

@Injectable()
export class CardsService {
  constructor(
    @InjectModel(Card.name) private readonly CardRepo: Model<CardDocument>,
    @InjectModel(Task.name) private readonly TaskRepo: Model<TaskDocument>,
    @InjectModel(Project.name) private readonly ProjectRepo: Model<Project>,
    @InjectModel(Auth.name) private readonly AuthRepo: Model<Auth>,
    private readonly jwt: JwtService
  ) { }

  async validateProjectAccess(userId: string, projectId: string) {
    const project = await this.ProjectRepo.findById(projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    const isOwner = project.owner.toString() === userId;
    const isCollaborator = project.collobrators?.some(id => id.toString() === userId);

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

    return card;
  }

  async createTask(userId: string, dto: CreateTaskDto) {
    const project = await this.ProjectRepo.findById(dto.projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    // Check if user is owner or collaborator
    const isOwner = project.owner.toString() === userId;
    const isCollaborator = project.collobrators?.some(id => id.toString() === userId);
    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const card = await this.CardRepo.findById(dto.cardId).exec();
    if (!card) throw new NotFoundException('Target card (column) not found');

    // Auto-calculate next order in this card
    const lastTask = await this.TaskRepo.findOne({
      cardId: new Types.ObjectId(dto.cardId)
    }).sort({ order: -1 }).exec();
    const nextOrder = lastTask ? lastTask.order + 1 : 0;

    const task = await this.TaskRepo.create({
      name: dto.name,
      description: dto.description,
      cardId: new Types.ObjectId(dto.cardId),
      projectId: new Types.ObjectId(dto.projectId),
      order: nextOrder,
      history: [{
        action: 'created',
        toCard: new Types.ObjectId(dto.cardId),
        by: new Types.ObjectId(userId),
        at: new Date()
      }]
    });

    return task;
  }

  async moveTask(userId: string, dto: MoveTaskDto) {
    const task = await this.TaskRepo.findById(dto.taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    const project = await this.ProjectRepo.findById(task.projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    // Check permissions
    const isOwner = project.owner.toString() === userId;
    const isCollaborator = project.collobrators?.some(id => id.toString() === userId);
    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this task');
    }

    const fromCardId = task.cardId;
    const toCardId = new Types.ObjectId(dto.toCardId);

    // Auto-calculate next order in the destination card
    const lastTaskInToCard = await this.TaskRepo.findOne({
      cardId: toCardId
    }).sort({ order: -1 }).exec();
    const nextOrder = lastTaskInToCard ? lastTaskInToCard.order + 1 : 0;

    task.cardId = toCardId;
    task.order = nextOrder;

    if (fromCardId.toString() !== toCardId.toString()) {
      // Record history
      task.history.push({
        action: 'moved',
        fromCard: fromCardId,
        toCard: toCardId,
        by: new Types.ObjectId(userId),
        at: new Date()
      });
    }


    await task.save();
    return task;
  }

  async getTaskHistory(userId: string, taskId: string) {
    const task = await this.TaskRepo.findById(taskId).select('+history').exec();
    if (!task) throw new NotFoundException('Task not found');

    await this.validateProjectAccess(userId, task.projectId.toString());

    return task.history;
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
    await this.CardRepo.findByIdAndDelete(cardId).exec();

    return { cardId, projectId: card.projectId };
  }

  async updateTask(userId: string, taskId: string, dto: any) {
    const task = await this.TaskRepo.findById(taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    const project = await this.ProjectRepo.findById(task.projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    const isOwner = project.owner.toString() === userId;
    const isCollaborator = project.collobrators?.some(id => id.toString() === userId);
    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // Record update in history
    task.history.push({
      action: 'updated',
      by: new Types.ObjectId(userId),
      at: new Date()
    });

    const updated = await this.TaskRepo.findByIdAndUpdate(taskId, dto, { returnDocument: 'after' }).exec();
    if (!updated) throw new NotFoundException('Task not found after update');
    return updated;
  }

  async removeTask(userId: string, taskId: string) {
    const task = await this.TaskRepo.findById(taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    const project = await this.ProjectRepo.findById(task.projectId).exec();
    if (!project || project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the project owner can delete tasks');
    }

    await this.TaskRepo.findByIdAndDelete(taskId).exec();
    return { taskId, projectId: task.projectId };
  }

  async getBoard(userId: string, projectId: string) {
    const project = await this.ProjectRepo.findById(projectId)
      .populate('owner', 'firstname lastname email avatar')
      .populate('collobrators', 'firstname lastname email avatar')
      .exec();

    if (!project) throw new NotFoundException('Project not found');

    const isOwner = project.owner['_id'].toString() === userId;
    const isCollaborator = project.collobrators?.some(c => c['_id'].toString() === userId);
    
    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const cards = await this.CardRepo.find({ projectId: new Types.ObjectId(projectId) }).sort({ order: 1 }).exec();

    const tasksQuery = this.TaskRepo.find({ projectId: new Types.ObjectId(projectId) }).sort({ order: 1 });
    if (isOwner) {
      tasksQuery.select('+history');
    }
    const tasks = await tasksQuery.exec();

    return {
      project,
      cards,
      tasks
    };
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
