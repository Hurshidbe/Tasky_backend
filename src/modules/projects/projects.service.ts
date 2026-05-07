import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Project } from './entities/project.entity';
import { Auth } from '../auth/schema/auth.schema';
import { Card } from '../cards/entities/card.entity';
import { Task } from '../cards/entities/task.entity';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { MailService } from '../nodeMailer/mailer.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name) private readonly ProjectsRepo: Model<Project>,
    @InjectModel(Auth.name) private readonly AuthRepo: Model<Auth>,
    @InjectModel(Card.name) private readonly CardRepo: Model<Card>,
    @InjectModel(Task.name) private readonly TaskRepo: Model<Task>,
    private readonly jwt: JwtService,
    private readonly mailService: MailService,
    private readonly cloudinaryService: CloudinaryService
  ) { }

  async create(owner: string, createProjectDto: CreateProjectDto) {
    const created = await this.ProjectsRepo.create({
      name: createProjectDto.name,
      description: createProjectDto.description,
      project_icon: createProjectDto.project_icon,
      owner: new Types.ObjectId(owner),
      collobrators: createProjectDto.collobrators || []
    });
    return created;
  }

  async findAll(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    return this.ProjectsRepo.find({
      $or: [
        { owner: userId },
        { owner: userObjectId as any },
        { collobrators: userId },
        { collobrators: userObjectId as any }
      ]
    })
      .populate('owner', 'firstname lastname avatar')
      .populate('collobrators', 'firstname lastname avatar')
      .exec();
  }

  async findOne(id: string, userId: string) {
    // ID to'g'ri formatda ekanligini oldindan tekshiramiz (CastError ni oldini olish uchun)
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      throw new BadRequestException('Invalid project ID format');
    }

    const project = await this.ProjectsRepo.findById(id).exec();
    if (!project) throw new NotFoundException('Project not found');

    // Check if user is owner OR a collaborator
    if (project.owner.toString() !== userId && !project.collobrators?.includes(userId)) {
      throw new ForbiddenException('You do not have access to this project');
    }
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) throw new BadRequestException('Invalid project ID format');

    const project = await this.ProjectsRepo.findById(id).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the owner can update the project');
    }

    const updated = await this.ProjectsRepo.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!updated) throw new NotFoundException('Failed to update project');
    return updated;
  }

  async remove(id: string, userId: string) {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) throw new BadRequestException('Invalid project ID format');

    const project = await this.ProjectsRepo.findById(id).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the owner can delete the project');
    }

    // Cascade delete: Cards and Tasks
    await this.CardRepo.deleteMany({ projectId: new Types.ObjectId(id) }).exec();
    await this.TaskRepo.deleteMany({ projectId: new Types.ObjectId(id) }).exec();

    const deleted = await this.ProjectsRepo.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Failed to delete project');
    return deleted;
  }

  async inviteCollaborator(userId: string, projectId: string, emailOrUsername: string, message?: string) {
    // 1. Check project and ownership
    const project = await this.ProjectsRepo.findById(projectId).exec();
    if (!project) throw new NotFoundException('Project not found');
    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the owner can invite collaborators');
    }

    // 2. Find target user
    const targetUser = await this.AuthRepo.findOne({
      $or: [
        { email: emailOrUsername.toLocaleLowerCase() },
        { username: emailOrUsername }
      ]
    }).exec();

    if (!targetUser || !targetUser.is_email_verified) {
      throw new BadRequestException('unverified/unsigned email error');
    }

    // 3. Find inviter user for the email
    const inviter = await this.AuthRepo.findById(userId).exec();
    const inviterName = inviter?.firstname || 'Someone';

    // 4. Generate JWT Token
    const inviteToken = await this.jwt.signAsync(
      { projectId: project._id, email: targetUser.email },
      { expiresIn: '7d' } // 7 kun amal qiladi
    );

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const inviteLink = `${backendUrl}/projects/join/${inviteToken}`;

    // 5. Send Email
    await this.mailService.sendCollaboratorInvite(targetUser.email, project.name, inviterName, inviteLink, message);

    return { success: true, message: `Invitation sent to ${targetUser.email}` };
  }

  async acceptInvitation(token: string) {
    let payload;
    try {
      payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_SECRET });
    } catch (error) {
      throw new BadRequestException('Invalid or expired invitation link');
    }

    const { projectId, email } = payload;

    const user = await this.AuthRepo.findOne({ email }).exec();
    if (!user) throw new BadRequestException('User no longer exists');

    const project = await this.ProjectsRepo.findById(projectId).exec();
    if (!project) throw new BadRequestException('Project no longer exists');

    const userIdStr = user._id.toString();

    // Do not add if already a collaborator or owner
    if (project.owner.toString() === userIdStr || project.collobrators?.includes(userIdStr)) {
      return { projectName: project.name, message: 'You are already in this project' };
    }

    project.collobrators = project.collobrators || [];
    project.collobrators.push(userIdStr);
    await project.save();

    return { projectName: project.name, user: user._id };
  }

  async removeCollaborator(ownerId: string, projectId: string, collaboratorId: string) {
    const project = await this.ProjectsRepo.findById(projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== ownerId) {
      throw new ForbiddenException('Only the owner can remove collaborators');
    }

    if (!project.collobrators?.includes(collaboratorId)) {
      throw new BadRequestException('User is not a collaborator in this project');
    }

    project.collobrators = project.collobrators.filter(id => id !== collaboratorId);
    await project.save();

    return { success: true, message: 'Collaborator removed successfully' };
  }

  async uploadProjectBackground(file: Express.Multer.File) {
    return await this.cloudinaryService.uploadOneImage(file);
  }

  async updateBackground(projectId: string, userId: string, imageUrl: string) {
    if (!projectId.match(/^[0-9a-fA-F]{24}$/)) throw new BadRequestException('Invalid project ID format');

    const project = await this.ProjectsRepo.findById(projectId).exec();
    if (!project) throw new NotFoundException('Project not found');

    if (project.owner.toString() !== userId) {
      throw new ForbiddenException('Only the owner can change the background');
    }

    project.background = imageUrl;
    await project.save();

    return { success: true, background: project.background };
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
