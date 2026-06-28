import { MailerService } from "@nestjs-modules/mailer";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { Types } from "mongoose";
import { ConfigService } from "@nestjs/config";

import { getActivateEmailTemplate } from "./templates/activate-email.template.js";
import { getResetPasswordTemplate } from "./templates/reset-password.template.js";
import { getCollaboratorInviteTemplate } from "./templates/collaborator-invite.template.js";
import { getInvitationAcceptedTemplate } from "./templates/invitation-accepted.template.js";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async sendActivateEmail(userId: Types.ObjectId, email: string) {
    try {
      const verifyLinkBase = this.configService.get<string>('mail.verifyLink');
      const verificationLink = `${verifyLinkBase}/${userId}`;

      return await this.mailerService.sendMail({
        to: email,
        from: this.configService.get<string>('mail.user') ?? '',
        subject: 'Email Verification',
        text: `Verify your email on TASKY by clicking this link: ${verificationLink}`,
        html: getActivateEmailTemplate(verificationLink),
      });
    } catch (error: any) {
      this.logger.error(`Failed to send activation email to ${email}:`, error.stack);
      throw new BadRequestException(`Failed to send verification email: ${error.message || error}`);
    }
  }

  async sendResetPasswordLink(userId: Types.ObjectId, email: string) {
    try {
      const frontendUrl = this.configService.get<string>('app.frontendUrl', 'http://localhost:3001');
      const resetLink = `${frontendUrl}/auth/reset-password/${userId}`;

      return await this.mailerService.sendMail({
        to: email,
        from: this.configService.get<string>('mail.user') ?? '',
        subject: 'Reset Password Request',
        text: `Reset your password on TASKY by clicking this link: ${resetLink}`,
        html: getResetPasswordTemplate(resetLink),
      });
    } catch (error: any) {
      this.logger.error(`Failed to send password reset link to ${email}:`, error.stack);
      throw new BadRequestException(`Failed to send reset password email: ${error.message || error}`);
    }
  }

  async sendCollaboratorInvite(
    email: string,
    projectName: string,
    inviterName: string,
    inviteLink: string,
    customMessage?: string,
  ) {
    try {
      return await this.mailerService.sendMail({
        to: email,
        from: this.configService.get<string>('mail.user') ?? '',
        subject: `Invitation to collaborate on ${projectName}`,
        text: `${inviterName} has invited you to collaborate on ${projectName}. Click here to join: ${inviteLink}`,
        html: getCollaboratorInviteTemplate(projectName, inviterName, inviteLink, customMessage),
      });
    } catch (error: any) {
      this.logger.error(`Failed to send collaborator invite to ${email}:`, error.stack);
      throw new BadRequestException(`Failed to send invitation email: ${error.message}`);
    }
  }

  async sendInvitationAccepted(
    ownerEmail: string,
    projectName: string,
    collaboratorName: string,
    collaboratorEmail: string,
  ) {
    try {
      return await this.mailerService.sendMail({
        to: ownerEmail,
        from: this.configService.get<string>('mail.user') ?? '',
        subject: `Invitation Accepted: ${collaboratorName} has joined ${projectName}`,
        text: `${collaboratorName} (${collaboratorEmail}) has accepted your invitation to collaborate on ${projectName}.`,
        html: getInvitationAcceptedTemplate(projectName, collaboratorName, collaboratorEmail),
      });
    } catch (error: any) {
      this.logger.error(`Failed to send invitation accepted email to ${ownerEmail}:`, error.stack);
    }
  }
}
