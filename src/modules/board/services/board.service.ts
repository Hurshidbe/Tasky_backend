import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Column, ColumnDocument } from '../schemas/column.schema.js';
import { Task, TaskDocument } from '../schemas/task.schema.js';
import { Project } from '../../project/schemas/project.schema.js';
import { Activity, ActivityDocument } from '../../project/schemas/activity.schema.js';
import { ACTIVITY_FEED_LIMIT } from '../../../common/constants/app.constants.js';

@Injectable()
export class BoardService {
  constructor(
    @InjectModel(Column.name) private readonly columnRepo: Model<ColumnDocument>,
    @InjectModel(Task.name) private readonly taskRepo: Model<TaskDocument>,
    @InjectModel(Project.name) private readonly projectRepo: Model<Project>,
    @InjectModel(Activity.name) private readonly activityRepo: Model<ActivityDocument>,
  ) {}

  async getBoard(userId: string, projectId: string) {
    const project = await this.projectRepo
      .findById(projectId)
      .populate('owner', 'firstname lastname email avatar username profession about createdAt')
      .populate('collaborators', 'firstname lastname email avatar username profession about createdAt')
      .exec();

    if (!project) throw new NotFoundException('Project not found');

    const isOwner = (project.owner as any)['_id']?.toString() === userId;
    const isCollaborator = (project.collaborators as any[])?.some(
      (c) => c['_id']?.toString() === userId,
    );

    if (!isOwner && !isCollaborator) {
      throw new ForbiddenException('You do not have access to this project');
    }

    const cards = await this.columnRepo
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ order: 1 })
      .exec();

    const tasksQuery = this.taskRepo
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ cardId: 1, order: 1 });

    if (isOwner) tasksQuery.select('+history');
    const tasks = await tasksQuery.exec();

    const activities = await this.activityRepo
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_FEED_LIMIT)
      .exec();

    return { cards, tasks, project, activities };
  }

  async getActivities(projectId: string) {
    return this.activityRepo
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ createdAt: -1 })
      .limit(ACTIVITY_FEED_LIMIT)
      .exec();
  }
}
