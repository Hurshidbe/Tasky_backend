export function getResetPasswordTemplate(resetLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
      <h2 style="color: #333;">Reset Your Password</h2>
      <p style="color: #555;">Click the button below to reset your password on <strong>TASKY</strong>.</p>
      <a href="${resetLink}" 
         style="
           display: inline-block;
           padding: 12px 24px;
           margin: 20px 0;
           font-size: 16px;
           color: #fff;
           background-color: #3b82f6;
           text-decoration: none;
           border-radius: 6px;
         ">
        Reset Password
      </a>
      <p style="color: #888; font-size: 12px;">
        If the button doesn’t work, copy and paste this link into your browser:<br>
        <a href="${resetLink}" style="color: #3b82f6;">${resetLink}</a>
      </p>
    </div>
  `;
}
