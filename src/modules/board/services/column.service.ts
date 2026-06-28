import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Column, ColumnDocument } from '../schemas/column.schema.js';
import { Task, TaskDocument } from '../schemas/task.schema.js';
import { Project } from '../../project/schemas/project.schema.js';
import { CreateCardDto } from '../dto/create-card.dto.js';
import { ActivityLoggerService } from '../../../common/services/activity-logger.service.js';

@Injectable()
export class ColumnService {
  constructor(
    @InjectModel(Column.name) private readonly columnRepo: Model<ColumnDocument>,
    @InjectModel(Task.name) private readonly taskRepo: Model<TaskDocument>,
    @InjectModel(Project.name) private readonly projectRepo: Model<Project>,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  async createColumn(userId: string, dto: CreateCardDto) {
    const project = await this.projectRepo.findById(dto.projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the project owner can create columns');
    }

    const existingColumn = await this.columnRepo
      .findOne({
        projectId: new Types.ObjectId(dto.projectId),
        title: dto.title,
      })
      .exec();

    if (existingColumn) {
      throw new BadRequestException(
        `Column with title "${dto.title}" already exists in this project`,
      );
    }

    const lastColumn = await this.columnRepo
      .findOne({ projectId: new Types.ObjectId(dto.projectId) })
      .sort({ order: -1 })
      .exec();
    const nextOrder = lastColumn ? lastColumn.order + 1 : 0;

    const column = await this.columnRepo.create({
      title: dto.title,
      projectId: new Types.ObjectId(dto.projectId),
      order: nextOrder,
    });

    await this.activityLogger.log(dto.projectId, userId, 'column_created', {
      cardId: column._id as any,
      data: { title: dto.title },
    });

    return column;
  }

  async updateColumn(userId: string, columnId: string, dto: any) {
    const column = await this.columnRepo.findById(columnId).exec();
    if (!column) throw new NotFoundException('Column not found');

    const project = await this.projectRepo.findById(column.projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the project owner can update columns');
    }

    if (dto.title) {
      const existing = await this.columnRepo
        .findOne({
          projectId: column.projectId,
          title: dto.title,
          _id: { $ne: column._id },
        })
        .exec();
      if (existing) {
        throw new BadRequestException(`Column with title "${dto.title}" already exists`);
      }
    }

    const updated = await this.columnRepo
      .findByIdAndUpdate(columnId, dto, { returnDocument: 'after' })
      .exec();
    if (!updated) throw new NotFoundException('Column not found after update');

    if (dto.title && column.title !== dto.title) {
      await this.activityLogger.log(column.projectId.toString(), userId, 'column_renamed', {
        cardId: column._id as any,
        data: { oldTitle: column.title, newTitle: dto.title },
      });
    }

    return updated;
  }

  async removeColumn(userId: string, columnId: string) {
    const column = await this.columnRepo.findById(columnId).exec();
    if (!column) throw new NotFoundException('Column not found');

    const project = await this.projectRepo.findById(column.projectId).exec();
    if (!project || project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the project owner can delete columns');
    }

    // Cascade delete tasks inside this column
    await this.taskRepo.deleteMany({ cardId: new Types.ObjectId(columnId) }).exec();

    await this.activityLogger.log(column.projectId.toString(), userId, 'column_deleted', {
      cardId: column._id as any,
      data: { title: column.title },
    });

    await this.columnRepo.findByIdAndDelete(columnId).exec();

    return { cardId: columnId, projectId: column.projectId };
  }
}
