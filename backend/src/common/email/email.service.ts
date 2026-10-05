import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendApiKey = process.env.RESEND_API_KEY;
  private readonly resendFromEmail = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || 'Pharma UCI <support@pharma-uci.com>';
  private readonly frontendUrl = (process.env.FRONTEND_URL || 'https://pharma-uci.com').replace(/\/$/, '');

  private escapeHtml(value: string): string {
    const replacements: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return value.replace(/[&<>"']/g, (character) => replacements[character]);
  }

  async sendStaffInvitation(email: string, fullName: string, token: string) {
    const inviteLink = `${this.frontendUrl}/auth/verify-invite?token=${token}`;
    const recipientName = this.escapeHtml(fullName);
    const subject = 'You have been invited to Pharma UCI';
    const htmlContent = `
      <div style="margin:0;background:#f1f4f2;padding:32px 16px;font-family:Arial,sans-serif;color:#18332e;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe4e0;border-radius:16px;overflow:hidden;">
          <div style="padding:24px 28px;border-bottom:1px solid #e3e9e6;">
            <span style="display:inline-grid;width:38px;height:38px;margin-right:10px;border-radius:12px;background:#0f5a4f;color:#ffffff;font-size:20px;font-weight:700;line-height:38px;text-align:center;vertical-align:middle;">U</span>
            <strong style="font-size:21px;letter-spacing:-0.3px;vertical-align:middle;">Pharma UCI</strong>
          </div>
          <div style="padding:32px 28px;">
            <p style="margin:0 0 10px;color:#0f7668;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Staff invitation</p>
            <h1 style="margin:0 0 18px;color:#18332e;font-size:28px;font-weight:600;line-height:1.2;">Set up your Pharma UCI account</h1>
            <p style="margin:0 0 14px;line-height:1.65;">Hello <strong>${recipientName}</strong>,</p>
            <p style="margin:0;line-height:1.65;color:#586d67;">A clinic administrator has invited you to join their workspace. Set a password to access the tools assigned to your role.</p>
            <div style="margin:28px 0;">
              <a href="${inviteLink}" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#0f5a4f;color:#ffffff;font-weight:700;text-decoration:none;">Set up my account</a>
            </div>
            <p style="margin:0;color:#6f817b;font-size:13px;line-height:1.55;">This invitation expires in 48 hours. If you were not expecting it, you can ignore this email.</p>
          </div>
          <div style="padding:18px 28px;background:#f7f9f8;color:#7b8b86;font-size:12px;line-height:1.55;word-break:break-all;">If the button does not work, open this link:<br>${inviteLink}</div>
        </div>
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
    const recipientName = this.escapeHtml(fullName);
    const subject = 'Reset your Pharma UCI password';
    const htmlContent = `
      <div style="margin:0;background:#f1f4f2;padding:32px 16px;font-family:Arial,sans-serif;color:#18332e;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dbe4e0;border-radius:16px;overflow:hidden;">
          <div style="padding:24px 28px;border-bottom:1px solid #e3e9e6;">
            <span style="display:inline-grid;width:38px;height:38px;margin-right:10px;border-radius:12px;background:#0f5a4f;color:#ffffff;font-size:20px;font-weight:700;line-height:38px;text-align:center;vertical-align:middle;">U</span>
            <strong style="font-size:21px;letter-spacing:-0.3px;vertical-align:middle;">Pharma UCI</strong>
          </div>
          <div style="padding:32px 28px;">
            <p style="margin:0 0 10px;color:#0f7668;font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Account recovery</p>
            <h1 style="margin:0 0 18px;color:#18332e;font-size:28px;font-weight:600;line-height:1.2;">Reset your password</h1>
            <p style="margin:0 0 14px;line-height:1.65;">Hello <strong>${recipientName}</strong>,</p>
            <p style="margin:0;line-height:1.65;color:#586d67;">We received a request to reset your Pharma UCI password. Use the link below to choose a new one.</p>
            <div style="margin:28px 0;">
              <a href="${resetLink}" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#0f5a4f;color:#ffffff;font-weight:700;text-decoration:none;">Reset my password</a>
            </div>
            <p style="margin:0;color:#6f817b;font-size:13px;line-height:1.55;">This link expires in 1 hour and can only be used once. If you did not request it, no action is needed.</p>
          </div>
          <div style="padding:18px 28px;background:#f7f9f8;color:#7b8b86;font-size:12px;line-height:1.55;word-break:break-all;">If the button does not work, open this link:<br>${resetLink}</div>
        </div>
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
