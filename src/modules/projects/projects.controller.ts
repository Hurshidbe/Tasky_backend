import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, HttpException, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AuthGuard } from 'src/guards/Auth.guard';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) { }

  @UseGuards(AuthGuard)
  @Post()
  async create(@Req() req: any, @Body() createProjectDto: CreateProjectDto) {
    try {
      const userId = req.user.userId;
      return await this.projectsService.create(userId, createProjectDto);
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  @UseGuards(AuthGuard)
  @Get()
  async findAll(@Req() req: any) {
    try {
      const userId = req.user.userId;
      console.log("Projects search for userId:", userId);
      const projects = await this.projectsService.findAll(userId);
      console.log("Found projects count:", projects.length);
      return projects;
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  @UseGuards(AuthGuard)
  @Get(':id')
  async findOne(@Req() req: any, @Param('id') id: string) {
    try {
      const userId = req.user.userId;
      return await this.projectsService.findOne(id, userId);
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  @UseGuards(AuthGuard)
  @Patch(':id')
  async update(@Req() req: any, @Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    try {
      const userId = req.user.userId;
      return await this.projectsService.update(id, updateProjectDto, userId);
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  async remove(@Req() req: any, @Param('id') id: string) {
    try {
      const userId = req.user.userId;
      return await this.projectsService.remove(id, userId);
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  @UseGuards(AuthGuard)
  @Post('invite-collaborator')
  async inviteCollaborator(@Req() req: any, @Body() dto: { projectId: string, emailOrUsername: string, message?: string }) {
    try {
      const userId = req.user.userId;
      return await this.projectsService.inviteCollaborator(userId, dto.projectId, dto.emailOrUsername, dto.message);
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  @Get('join/:token')
  async joinProject(@Param('token') token: string, @Res() res: any) {
    try {
      const result = await this.projectsService.acceptInvitation(token);
      return res.send(`
        <div style="text-align: center; margin-top: 50px; font-family: sans-serif; background: #0f172a; color: white; height: 100vh; padding-top: 100px; margin: 0;">
            <div style="background: rgba(255,255,255,0.05); display: inline-block; padding: 40px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.1);">
                <h1 style="color: #10b981; margin-bottom: 20px;">Muvaffaqiyatli!</h1>
                <p style="font-size: 18px;">Siz <b>${result.projectName}</b> loyihasiga qo'shildingiz.</p>
                <br/>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}" style="background: #3b82f6; color: white; padding: 15px 30px; border-radius: 15px; text-decoration: none; font-weight: bold; display: inline-block; margin-top: 20px;">TASKY'ga o'tish</a>
            </div>
        </div>
      `);
    } catch (error) {
      return res.status(400).send(`
        <div style="text-align: center; margin-top: 50px; font-family: sans-serif; background: #0f172a; color: white; height: 100vh; padding-top: 100px; margin: 0;">
             <div style="background: rgba(255,255,255,0.05); display: inline-block; padding: 40px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.1);">
                <h1 style="color: #ef4444; margin-bottom: 20px;">Xatolik</h1>
                <p>${error.message}</p>
                <br/>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}" style="color: #3b82f6; text-decoration: none;">Asosiy sahifaga qaytish</a>
            </div>
        </div>
      `);
    }
  }

  @UseGuards(AuthGuard)
  @Post(':id/background')
  @UseInterceptors(FileInterceptor('photo'))
  async updateBackground(@Req() req: any, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    try {
      const userId = req.user.userId;
      const img_url = await this.projectsService.uploadProjectBackground(file);
      return await this.projectsService.updateBackground(id, userId, <string>img_url);
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }

  @UseGuards(AuthGuard)
  @Delete(':id/collaborator/:collaboratorId')
  async removeCollaborator(@Req() req: any, @Param('id') id: string, @Param('collaboratorId') collaboratorId: string) {
    try {
      const userId = req.user.userId;
      return await this.projectsService.removeCollaborator(userId, id, collaboratorId);
    } catch (error) {
      throw new HttpException(error.message, error.status || 500);
    }
  }
}
