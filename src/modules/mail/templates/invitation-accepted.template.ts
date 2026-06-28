export function getInvitationAcceptedTemplate(
  projectName: string,
  collaboratorName: string,
  collaboratorEmail: string,
): string {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.5; color: #333;">
      <h2 style="color: #4CAF50;">Invitation Accepted!</h2>
      <p>Great news! <strong>${collaboratorName}</strong> (<em>${collaboratorEmail}</em>) has accepted your invitation to collaborate on your project <strong>${projectName}</strong>.</p>
      <p>They are now a collaborator on your project board and can participate in tasks.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #777;">Thank you for using TASKY.</p>
    </div>
  `;
}
