export function getActivateEmailTemplate(verificationLink: string): string {
  return `
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
  `;
}
