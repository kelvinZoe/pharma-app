import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendApiKey = process.env.RESEND_API_KEY;
  private readonly resendFromEmail = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || 'Clinical Suite <onboarding@resend.dev>';
  private readonly frontendUrl = (process.env.FRONTEND_URL || 'https://pharma-uci.com').replace(/\/$/, '');

  async sendStaffInvitation(email: string, fullName: string, token: string) {
    const inviteLink = `${this.frontendUrl}/auth/verify-invite?token=${token}`;
    const subject = 'Join your Clinical Suite Workspace';
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0d9488; margin-top: 0;">Clinician Onboarding Protocol</h2>
        <p>Hello <strong>${fullName}</strong>,</p>
        <p>You have been registered as a clinician staff member in the Clinical Suite management platform.</p>
        <p>Please click the button below to verify your email, set your secure password, and activate your role-based workspace session:</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${inviteLink}" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Activate Account</a>
        </div>
        <p style="color: #64748b; font-size: 0.875rem;">This activation link will expire in 48 hours.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 0.75rem;">If the button doesn't work, copy and paste this URL into your browser:<br/>${inviteLink}</p>
      </div>
    `;

    if (!this.resendApiKey) {
      this.logger.warn(`RESEND_API_KEY is not set. Simulation invitation link logged below:`);
      this.logger.warn(`👉 INVITE LINK: ${inviteLink}`);
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.resendFromEmail,
          to: [email],
          subject: subject,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Resend API error (${response.status}): ${errBody}`);
      }

      this.logger.log(`Onboarding invitation email successfully dispatched to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send invitation email via Resend to ${email}:`, error);
      this.logger.warn(`👉 FALLBACK INVITE LINK: ${inviteLink}`);
    }
  }

  async sendPasswordReset(email: string, fullName: string, token: string) {
    const resetLink = `${this.frontendUrl}/auth/reset-password?token=${token}`;
    const subject = 'Reset your Pharma Flow password';
    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #0d9488; margin-top: 0;">Password Reset Request</h2>
        <p>Hello <strong>${fullName}</strong>,</p>
        <p>We received a request to reset the password for your Pharma Flow account.</p>
        <p>Click the button below to set a new secure password. This link expires in 1 hour.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetLink}" style="background-color: #0d9488; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Reset Password</a>
        </div>
        <p style="color: #64748b; font-size: 0.875rem;">If you did not request this reset, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 0.75rem;">If the button doesn't work, copy and paste this URL into your browser:<br/>${resetLink}</p>
      </div>
    `;

    if (!this.resendApiKey) {
      this.logger.warn(`RESEND_API_KEY is not set. Simulation password reset link logged below:`);
      this.logger.warn(`👉 PASSWORD RESET LINK: ${resetLink}`);
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.resendFromEmail,
          to: [email],
          subject,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Resend API error (${response.status}): ${errBody}`);
      }

      this.logger.log(`Password reset email successfully dispatched to ${email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email via Resend to ${email}:`, error);
      this.logger.warn(`👉 FALLBACK PASSWORD RESET LINK: ${resetLink}`);
    }
  }
}
