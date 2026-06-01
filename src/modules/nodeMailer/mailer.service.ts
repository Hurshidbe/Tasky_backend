import { MailerService } from "@nestjs-modules/mailer";
import { BadRequestException, HttpException, Injectable, Type } from "@nestjs/common";
import { Types } from "mongoose";
import { Auth } from "../auth/schema/auth.schema";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) { }

  async sendActivateEmail(user_id: Types.ObjectId, email: string) {
    try {
      const verificationLink = `${this.configService.get('EMAIL_VERIFY_LINK')}/${user_id}`
      return await this.mailerService.sendMail({
        to: email,
        from: this.configService.get('MAIL') ?? '',
        subject: 'Email verification',
        text: 'click this button to verify your email on TASKY',
        html: `
      <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
        <h2 style="color: #333;">Verify Your Email</h2>
        <p style="color: #555;">Click the button below to verify your email address on <strong>TASKY</strong>.</p>
        <a href="${verificationLink}" 
           style="
             display: inline-block;
             padding: 12px 24px;
             margin: 20px 0;
             font-size: 16px;
             color: #fff;
             background-color: #4CAF50;
             text-decoration: none;
             border-radius: 6px;
           ">
          Verify Email
        </a>
        <p style="color: #888; font-size: 12px;">
          If the button doesn’t work, copy and paste this link into your browser:<br>
          <a href="${verificationLink}" style="color: #4CAF50;">${verificationLink}</a>
        </p>
      </div>
    `
      })
    } catch (error) {
      throw new BadRequestException(`email jo'natishda hatolik : ${error}`)
    }
  }

  async sendResetPasswordLink(Id: Types.ObjectId, email: string) {
    try {
      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
      const text = `Passwordingizni yangilash uchun follow this link : ${frontendUrl}/auth/reset-password/${Id}`
      return await this.mailerService.sendMail({
        to: email,
        from: this.configService.get('MAIL') ?? '',
        subject: 'Reset-password',
        text,
      })
    } catch (error) {
      throw new BadRequestException(`email jo'natishda hatolik : ${error}`)
    }
  }

  async sendCollaboratorInvite(email: string, projectName: string, inviterName: string, inviteLink: string, customMessage?: string) {
    try {

      
      const result = await this.mailerService.sendMail({
        to: email,
        from: this.configService.get('MAIL') ?? '',
        subject: `Invitation to collaborate on ${projectName}`,
        text: `${inviterName} has invited you to collaborate on ${projectName}. Click here to join: ${inviteLink}`,
        html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2>You have been invited!</h2>
                  <p><strong>${inviterName}</strong> has invited you to join the project <strong>${projectName}</strong> on TASKY.</p>
                  ${customMessage ? `<p style="padding: 10px; background: #f4f4f4; border-left: 4px solid #007bff;">"${customMessage}"</p>` : ''}
                  <div style="margin: 20px 0;">
                    <a href="${inviteLink}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a>
                  </div>
                  <p style="font-size: 12px; color: #777;">
                    If the button doesn't work, copy and paste this link: <br>
                    ${inviteLink}
                  </p>
                </div>
              `
      });
      
      return result;
    } catch (error) {
      throw new BadRequestException(`Failed to send invitation email: ${error.message}`);
    }
  }

  async sendInvitationAccepted(ownerEmail: string, projectName: string, collaboratorName: string, collaboratorEmail: string) {
    try {
      const result = await this.mailerService.sendMail({
        to: ownerEmail,
        from: this.configService.get('MAIL') ?? '',
        subject: `Invitation Accepted: ${collaboratorName} has joined ${projectName}`,
        text: `${collaboratorName} (${collaboratorEmail}) has accepted your invitation to collaborate on ${projectName}.`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.5; color: #333;">
            <h2 style="color: #4CAF50;">Invitation Accepted!</h2>
            <p>Great news! <strong>${collaboratorName}</strong> (<em>${collaboratorEmail}</em>) has accepted your invitation to collaborate on your project <strong>${projectName}</strong>.</p>
            <p>They are now a collaborator on your project board and can participate in tasks.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #777;">Thank you for using TASKY.</p>
          </div>
        `
      });
      return result;
    } catch (error) {
      console.error(`Failed to send acceptance notification email: ${error.message}`);
    }
  }
}