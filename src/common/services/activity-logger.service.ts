import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity, ActivityDocument } from '../../modules/project/schemas/activity.schema.js';
import { Auth } from '../../modules/auth/schema/auth.schema.js';

/**
 * Centralized activity logging service.
 * Previously, logActivity() was duplicated in both CardsService and ProjectsService.
 * This shared service eliminates that duplication (DRY principle).
 */
@Injectable()
export class ActivityLoggerService {
  private readonly logger = new Logger(ActivityLoggerService.name);

  constructor(
    @InjectModel(Activity.name) private readonly activityRepo: Model<ActivityDocument>,
    @InjectModel(Auth.name) private readonly authRepo: Model<Auth>,
  ) {}

  async log(
    projectId: string,
    userId: string,
    type: string,
    details: Partial<Activity> = {},
  ): Promise<void> {
    try {
      const user = await this.authRepo.findById(userId).exec();
      const userName = user
        ? `${user.firstname} ${user.lastname || ''}`.trim()
        : 'Someone';
      const userAvatar = user?.avatar;

      await this.activityRepo.create({
        projectId: new Types.ObjectId(projectId),
        userId: new Types.ObjectId(userId),
        type,
        userName,
        userAvatar,
        ...details,
      });
    } catch (error) {
      this.logger.error(
        `Failed to log activity [${type}] for project ${projectId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async getByProject(projectId: string, limit = 50) {
    return this.activityRepo
      .find({ projectId: new Types.ObjectId(projectId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
