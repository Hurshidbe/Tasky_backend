export function getCollaboratorInviteTemplate(
  projectName: string,
  inviterName: string,
  inviteLink: string,
  customMessage?: string,
): string {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.5; color: #333;">
      <h2>You have been invited!</h2>
      <p><strong>${inviterName}</strong> has invited you to join the project <strong>${projectName}</strong> on TASKY.</p>
      ${
        customMessage
          ? `<p style="padding: 10px; background: #f4f4f4; border-left: 4px solid #007bff; font-style: italic;">"${customMessage}"</p>`
          : ''
      }
      <div style="margin: 20px 0;">
        <a href="${inviteLink}" 
           style="
             background: #007bff;
             color: white;
             padding: 10px 20px;
             text-decoration: none;
             border-radius: 5px;
             display: inline-block;
             font-weight: bold;
           ">Accept Invitation</a>
      </div>
      <p style="font-size: 12px; color: #777;">
        If the button doesn't work, copy and paste this link: <br>
        <a href="${inviteLink}" style="color: #007bff;">${inviteLink}</a>
      </p>
    </div>
  `;
}
