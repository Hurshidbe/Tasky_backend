import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseFilters, UsePipes, ValidationPipe, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

import { ProjectService } from './project.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { InviteCollaboratorDto } from './dto/invite-collaborator.dto.js';
import { WsExceptionFilter } from '../../common/filters/ws-exception.filter.js';

@UseFilters(new WsExceptionFilter())
@WebSocketGateway({ cors: { origin: '*' } })
export class ProjectGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ProjectGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly projectService: ProjectService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers.authorization;
      if (!token) {
        client.emit('exception', { message: 'Authentication token not found' });
        setTimeout(() => client.disconnect(), 100);
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });

      client.data.user = payload;
      client.data.userId = payload.userId;
      client.join(`user_${payload.userId}`);
      client.emit('connected');
    } catch {
      client.emit('exception', { message: 'Authentication failed: invalid or expired token' });
      setTimeout(() => client.disconnect(), 100);
    }
  }

  async handleDisconnect(_client: Socket) {}

  @SubscribeMessage('addProject')
  async handleAddProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateProjectDto,
  ) {
    try {
      const userId = client.data.user.userId;
      const project = await this.projectService.create(userId, dto);

      this.server.to(`user_${userId}`).emit('projectAdded', { success: true, data: project });
      return { success: true, data: project };
    } catch (error: any) {
      return { success: false, event: 'addProject', error: error.message };
    }
  }

  @SubscribeMessage('findAllProjects')
  async handleFindAllProjects(@ConnectedSocket() client: Socket) {
    try {
      const userId = client.data.user.userId;
      const projects = await this.projectService.findAll(userId);
      return { success: true, data: projects };
    } catch (error: any) {
      return { success: false, event: 'findAllProjects', error: error.message };
    }
  }

  @SubscribeMessage('findOneProject')
  async handleFindOneProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id: string },
  ) {
    try {
      const userId = client.data.user.userId;
      const project = await this.projectService.findOne(data.id, userId);
      return { success: true, data: project };
    } catch (error: any) {
      return { success: false, event: 'findOneProject', error: error.message };
    }
  }

  @SubscribeMessage('updateProject')
  async handleUpdateProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id: string; dto: UpdateProjectDto },
  ) {
    try {
      const userId = client.data.user.userId;
      const project = await this.projectService.update(data.id, data.dto, userId);

      const notifyUsers = [project.owner.toString(), ...(project.collaborators || [])];
      notifyUsers.forEach((id) => {
        this.server.to(`user_${id}`).emit('projectUpdated', { success: true, data: project });
      });

      return { success: true, data: project };
    } catch (error: any) {
      return { success: false, event: 'updateProject', error: error.message };
    }
  }

  @SubscribeMessage('removeProject')
  async handleRemoveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { id: string },
  ) {
    try {
      const userId = client.data.user.userId;
      const project = await this.projectService.findOne(data.id, userId);
      await this.projectService.remove(data.id, userId);

      const notifyUsers = [project.owner.toString(), ...(project.collaborators || [])];
      notifyUsers.forEach((notifyId) => {
        this.server.to(`user_${notifyId}`).emit('projectRemoved', { success: true, id: data.id });
      });

      return { success: true, id: data.id };
    } catch (error: any) {
      return { success: false, event: 'removeProject', error: error.message };
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('inviteCollaborator')
  async handleInviteCollaborator(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: InviteCollaboratorDto,
  ) {
    try {
      const userId = client.data.user.userId;
      return await this.projectService.inviteCollaborator(
        userId,
        dto.projectId,
        dto.emailOrUsername,
        dto.message,
      );
    } catch (error: any) {
      return { success: false, event: 'inviteCollaborator', error: error.message };
    }
  }

  @SubscribeMessage('removeCollaborator')
  async handleRemoveCollaborator(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; collaboratorId: string },
  ) {
    try {
      const ownerId = client.data.user.userId;
      const result = await this.projectService.removeCollaborator(
        ownerId,
        data.projectId,
        data.collaboratorId,
      );

      this.server
        .to(`user_${data.collaboratorId}`)
        .emit('removedFromProject', { projectId: data.projectId });

      return result;
    } catch (error: any) {
      return { success: false, event: 'removeCollaborator', error: error.message };
    }
  }
}
