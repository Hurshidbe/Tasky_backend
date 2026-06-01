import { WebSocketGateway, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, WebSocketServer, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { InviteCollaboratorDto } from './dto/invite-collaborator.dto';
import { UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { WsAllExceptionsFilter } from 'src/ws-exception.filter';

@UseFilters(new WsAllExceptionsFilter())
@WebSocketGateway({ cors: { origin: '*' } }) // must change before deploy
export class ProjectsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private readonly projectService: ProjectsService
  ) { }

  @WebSocketServer()
  server!: Server;

  async handleConnection(client: Socket) {
    try {
      const payload = await this.projectService.tokenChecker(client);
      if (!payload) {
        client.emit('exception', { message: 'token not found or expired' });
        setTimeout(() => client.disconnect(), 100);
        return;
      }
      client.data.userId = payload.userId;

      // Foydalanuvchini o'ziga xos xonaga (room) qo'shamiz
      // Bu orqali ushbu foydalanuvchiga tegishli loyihalardagi o'zgarishlarni bevosita o'ziga yuborish mumkin
      client.join(`user_${payload.userId}`);

      client.emit('connected');
      return;
    } catch (error) {
      client.emit('exception', { message: 'jwt error : token notfound/expired' });
      setTimeout(() => client.disconnect(), 100);
    }
  }

  async handleDisconnect(client: Socket) { }

  @SubscribeMessage('addProject')
  async handleAddProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CreateProjectDto,
  ) {
    try {
      await this.projectService.tokenChecker(client);
      const userId = client.data.user.userId;
      const project = await this.projectService.create(userId, dto);

      // Loyiha yangi ochilganda faqat uning egasi bo'ladi, shuning uchun faqat o'ziga yuboramiz
      this.server.to(`user_${userId}`).emit('projectAdded', { success: true, data: project });

      return { success: true, data: project };
    } catch (error) {
      return { success: false, event: 'addProject', error: error.message };
    }
  }

  @SubscribeMessage('findAllProjects')
  async handleFindAllProjects(
    @ConnectedSocket() client: Socket,
  ) {
    try {
      await this.projectService.tokenChecker(client);
      const userId = client.data.user.userId;
      const projects = await this.projectService.findAll(userId);
      return { success: true, data: projects };
    } catch (error) {
      return { success: false, event: 'findAllProjects', error: error.message };
    }
  }

  @SubscribeMessage('findOneProject')
  async handleFindOneProject(
    @ConnectedSocket() client: Socket,
    data: any,
  ) {
    try {
      const id = data.id;
      await this.projectService.tokenChecker(client);
      const userId = client.data.user.userId;
      const project = await this.projectService.findOne(id, userId);
      return { success: true, data: project };
    } catch (error) {
      return { success: false, event: 'findOneProject', error: error.message };
    }
  }

  @SubscribeMessage('updateProject')
  async handleUpdateProject(
    @ConnectedSocket() client: Socket,
    data: any,
  ) {
    try {
      const payload = data;
      await this.projectService.tokenChecker(client);
      const userId = client.data.user.userId;
      const project = await this.projectService.update(payload.id, payload.dto, userId);

      // O'zgarishlarni egasi va collaboratorlarga xabar qilamiz
      const notifyUsers = [project.owner.toString(), ...(project.collaborators || [])];
      notifyUsers.forEach(id => {
        this.server.to(`user_${id}`).emit('projectUpdated', { success: true, data: project });
      });

      return { success: true, data: project };
    } catch (error) {
      return { success: false, event: 'updateProject', error: error.message };
    }
  }

  @SubscribeMessage('removeProject')
  async handleRemoveProject(
    @ConnectedSocket() client: Socket,
    data: any,
  ) {
    try {
      const id = data.id;
      await this.projectService.tokenChecker(client);
      const userId = client.data.user.userId;

      // O'chirishdan oldin loyihani olamiz, toki kimlarga xabar yuborishni bilaylik
      const project = await this.projectService.findOne(id, userId);

      await this.projectService.remove(id, userId);

      // Loyiha o'chirilganini egasi va collaboratorlarga xabar qilamiz
      const notifyUsers = [project.owner.toString(), ...(project.collaborators || [])];
      notifyUsers.forEach(notifyId => {
        this.server.to(`user_${notifyId}`).emit('projectRemoved', { success: true, id });
      });

      return { success: true, id };
    } catch (error) {
      return { success: false, event: 'removeProject', error: error.message };
    }
  }

  @UsePipes(new ValidationPipe())
  @SubscribeMessage('inviteCollaborator')
  async handleInviteCollaborator(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: InviteCollaboratorDto
  ) {
    try {
      const payload = dto;
      await this.projectService.tokenChecker(client);
      const userId = client.data.user.userId;

      const result = await this.projectService.inviteCollaborator(
        userId,
        payload.projectId,
        payload.emailOrUsername,
        payload.message
      );

      return result;
    } catch (error) {
      return { success: false, event: 'inviteCollaborator', error: error.message };
    }
  }

  @SubscribeMessage('removeCollaborator')
  async handleRemoveCollaborator(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string, collaboratorId: string }
  ) {
    try {
      await this.projectService.tokenChecker(client);
      const ownerId = client.data.user.userId;
      const result = await this.projectService.removeCollaborator(ownerId, data.projectId, data.collaboratorId);

      // Hamkorni ogohlantiramiz
      this.server.to(`user_${data.collaboratorId}`).emit('removedFromProject', { projectId: data.projectId });

      return result;
    } catch (error) {
      return { success: false, event: 'removeCollaborator', error: error.message };
    }
  }
}
