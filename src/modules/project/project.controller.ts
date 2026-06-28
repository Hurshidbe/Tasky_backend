import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';

import { ProjectService } from './project.service.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@Controller('projects')
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly configService: ConfigService,
  ) {}

  @UseGuards(AuthGuard)
  @Post()
  async create(@CurrentUser() userId: string, @Body() dto: CreateProjectDto) {
    return this.projectService.create(userId, dto);
  }

  @UseGuards(AuthGuard)
  @Get()
  async findAll(@CurrentUser() userId: string) {
    return this.projectService.findAll(userId);
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  async findOne(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.projectService.findOne(id, userId);
  }

  @UseGuards(AuthGuard)
  @Patch(':id')
  async update(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(id, dto, userId);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  async remove(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.projectService.remove(id, userId);
  }

  @UseGuards(AuthGuard)
  @Post('invite-collaborator')
  async inviteCollaborator(
    @CurrentUser() userId: string,
    @Body() dto: { projectId: string; emailOrUsername: string; message?: string },
  ) {
    return this.projectService.inviteCollaborator(
      userId,
      dto.projectId,
      dto.emailOrUsername,
      dto.message,
    );
  }

  @Get('join/:token')
  async joinProject(@Param('token') token: string, @Res() res: any) {
    const frontendUrl = this.configService.get<string>('app.frontendUrl', 'http://localhost:3001');

    try {
      const result = await this.projectService.acceptInvitation(token);
      return res.send(`
        <div style="text-align: center; margin-top: 50px; font-family: sans-serif; background: #0f172a; color: white; height: 100vh; padding-top: 100px; margin: 0;">
            <div style="background: rgba(255,255,255,0.05); display: inline-block; padding: 40px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.1);">
                <h1 style="color: #10b981; margin-bottom: 20px;">Success!</h1>
                <p style="font-size: 18px;">You have joined the <b>${result.projectName}</b> project.</p>
                <br/>
                <a href="${frontendUrl}" style="background: #3b82f6; color: white; padding: 15px 30px; border-radius: 15px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 20px;">Go to TASKY</a>
            </div>
        </div>
      `);
    } catch (error: any) {
      return res.status(400).send(`
        <div style="text-align: center; margin-top: 50px; font-family: sans-serif; background: #0f172a; color: white; height: 100vh; padding-top: 100px; margin: 0;">
             <div style="background: rgba(255,255,255,0.05); display: inline-block; padding: 40px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.1);">
                <h1 style="color: #ef4444; margin-bottom: 20px;">Error</h1>
                <p>${error.message}</p>
                <br/>
                <a href="${frontendUrl}" style="color: #3b82f6; text-decoration: none;">Go back to home page</a>
            </div>
        </div>
      `);
    }
  }

  @UseGuards(AuthGuard)
  @Post(':id/background')
  @UseInterceptors(FileInterceptor('photo'))
  async updateBackground(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const imgUrl = await this.projectService.uploadProjectBackground(file);
    return this.projectService.updateBackground(id, userId, imgUrl as string);
  }

  @UseGuards(AuthGuard)
  @Delete(':id/collaborator/:collaboratorId')
  async removeCollaborator(
    @CurrentUser() userId: string,
    @Param('id') id: string,
    @Param('collaboratorId') collaboratorId: string,
  ) {
    return this.projectService.removeCollaborator(userId, id, collaboratorId);
  }
}
