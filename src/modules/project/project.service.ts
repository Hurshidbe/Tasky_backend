import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';

import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { Project } from './schemas/project.schema.js';
import { Auth } from '../auth/schema/auth.schema.js';
import { Column } from '../board/schemas/column.schema.js';
import { Task } from '../board/schemas/task.schema.js';
import { MailService } from '../mail/mail.service.js';
import { CloudinaryService } from '../cloudinary/cloudinary.service.js';
import { ActivityLoggerService } from '../../common/services/activity-logger.service.js';
import { isValidObjectId } from '../../common/helpers/mongo-id.validator.js';

@Injectable()
export class ProjectService {
  constructor(
    @InjectModel(Project.name) private readonly projectRepo: Model<Project>,
    @InjectModel(Auth.name) private readonly authRepo: Model<Auth>,
    @InjectModel(Column.name) private readonly columnRepo: Model<Column>,
    @InjectModel(Task.name) private readonly taskRepo: Model<Task>,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly activityLogger: ActivityLoggerService,
  ) {}

  async create(ownerId: string, dto: CreateProjectDto) {
    return this.projectRepo.create({
      name: dto.name,
      description: dto.description,
      project_icon: dto.project_icon,
      owner: new Types.ObjectId(ownerId),
      collaborators: dto.collaborators || [],
    });
  }

  async findAll(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.projectRepo
      .find({
        $or: [
          { owner: userId },
          { owner: userObjectId as any },
          { collaborators: userId },
          { collaborators: userObjectId as any },
        ],
      })
      .populate('owner', 'firstname lastname avatar')
      .populate('collaborators', 'firstname lastname avatar')
      .exec();
  }

  async findOne(id: string, userId: string) {
    if (!isValidObjectId(id)) {
      throw new BadRequestException('Invalid project ID format');
    }

    const project = await this.projectRepo.findById(id).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (
      project.owner.toString() !== userId &&
      !project.collaborators?.includes(userId)
    ) {
      throw new ForbiddenException('You do not have access to this project');
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid project ID format');

    const project = await this.projectRepo.findById(id).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the owner can update the project');
    }

    const updated = await this.projectRepo.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException('Failed to update project');

    await this.activityLogger.log(id, userId, 'project_updated', { data: dto });

    return updated;
  }

  async remove(id: string, userId: string) {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid project ID format');

    const project = await this.projectRepo.findById(id).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the owner can delete the project');
    }

    // Cascade delete cards and tasks
    await this.columnRepo.deleteMany({ projectId: new Types.ObjectId(id) }).exec();
    await this.taskRepo.deleteMany({ projectId: new Types.ObjectId(id) }).exec();

    const deleted = await this.projectRepo.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Failed to delete project');

    return deleted;
  }

  async inviteCollaborator(
    userId: string,
    projectId: string,
    emailOrUsername: string,
    message?: string,
  ) {
    const project = await this.projectRepo.findById(projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the owner can invite collaborators');
    }

    const targetUser = await this.authRepo
      .findOne({
        $or: [
          { email: emailOrUsername.toLowerCase() },
          { username: emailOrUsername },
        ],
      })
      .exec();

    if (!targetUser || !targetUser.is_email_verified) {
      throw new BadRequestException('User not found or email not verified');
    }

    const inviter = await this.authRepo.findById(userId).exec();
    const inviterName = inviter?.firstname || 'Someone';

    const inviteToken = await this.jwtService.signAsync(
      { projectId: project._id, email: targetUser.email },
      { expiresIn: '7d' },
    );

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const inviteLink = `${backendUrl}/projects/join/${inviteToken}`;

    await this.mailService.sendCollaboratorInvite(
      targetUser.email,
      project.name,
      inviterName,
      inviteLink,
      message,
    );

    await this.activityLogger.log(projectId, userId, 'collaborator_invited', {
      data: { email: targetUser.email },
    });

    return { success: true, message: `Invitation sent to ${targetUser.email}` };
  }

  async acceptInvitation(token: string) {
    let payload;
    try {
      payload = await this.jwtService.verifyAsync(token, { secret: process.env.JWT_SECRET });
    } catch {
      throw new BadRequestException('Invalid or expired invitation link');
    }

    const { projectId, email } = payload;

    const user = await this.authRepo.findOne({ email }).exec();
    if (!user) throw new BadRequestException('User no longer exists');

    const project = await this.projectRepo.findById(projectId).exec();
    if (!project) throw new BadRequestException('Project no longer exists');

    const userIdStr = user._id.toString();

    if (
      project.owner.toString() === userIdStr ||
      project.collaborators?.includes(userIdStr)
    ) {
      return { projectName: project.name, message: 'You are already in this project' };
    }

    project.collaborators = project.collaborators || [];
    project.collaborators.push(userIdStr);
    await project.save();

    await this.activityLogger.log(projectId, userIdStr, 'collaborator_joined');

    try {
      const ownerUser = await this.authRepo.findById(project.owner).exec();
      if (ownerUser?.email) {
        const collaboratorName = `${user.firstname} ${user.lastname || ''}`.trim();
        await this.mailService.sendInvitationAccepted(
          ownerUser.email,
          project.name,
          collaboratorName,
          user.email,
        );
      }
    } catch {
      // Non-critical notification failure
    }

    return { projectName: project.name, user: user._id };
  }

  async removeCollaborator(ownerId: string, projectId: string, collaboratorId: string) {
    const project = await this.projectRepo.findById(projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== ownerId) {
      throw new ForbiddenException('Only the owner can remove collaborators');
    }

    if (!project.collaborators?.some((id) => id?.toString() === collaboratorId)) {
      throw new BadRequestException('User is not a collaborator in this project');
    }

    project.collaborators = project.collaborators.filter(
      (id) => id && id.toString() !== collaboratorId,
    );
    await project.save();

    return { success: true, message: 'Collaborator removed successfully' };
  }

  async uploadProjectBackground(file: Express.Multer.File) {
    return this.cloudinaryService.uploadOneImage(file);
  }

  async updateBackground(projectId: string, userId: string, imageUrl: string) {
    if (!isValidObjectId(projectId)) throw new BadRequestException('Invalid project ID format');

    const project = await this.projectRepo.findById(projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the owner can change the background');
    }

    project.background = imageUrl;
    await project.save();

    await this.activityLogger.log(projectId, userId, 'background_updated', {
      data: { background: imageUrl },
    });

    return { success: true, background: project.background };
  }
}
