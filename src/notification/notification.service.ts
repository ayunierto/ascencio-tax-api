import { Injectable, Logger } from '@nestjs/common';
import { MailService } from 'src/mail/mail.service';
import { AppointmentDetailsDto } from './dto/appointment-details.dto';
import { SendMailOptions } from 'src/mail/interfaces';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private senderName: string;
  private readonly brandColor = '#2563eb'; // Modern blue
  private readonly companyAddress = '123 Tax Ave, Finance City'; // Placeholder or env var

  constructor(private readonly mailService: MailService) {
    this.senderName = process.env.MAILERSEND_SENDER_NAME || 'Ascencio Tax';
    if (!process.env.MAILERSEND_SENDER_NAME)
      this.logger.error('MAILERSEND_SENDER_NAME is not configured.');
  }

  private getEmailTemplate(title: string, content: string): string {
    const year = new Date().getFullYear();
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #333; }
            .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
            .header { background-color: ${this.brandColor}; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; letter-spacing: 0.5px; }
            .content { padding: 40px 30px; line-height: 1.6; color: #374151; }
            .content h2 { color: #111827; font-size: 20px; margin-top: 0; margin-bottom: 20px; }
            .content p { margin-bottom: 16px; }
            .code-block { background-color: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0; }
            .code { font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; color: ${this.brandColor}; letter-spacing: 4px; }
            .details-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
            .details-list { list-style: none; padding: 0; margin: 0; }
            .details-list li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
            .details-list li:last-child { border-bottom: none; }
            .details-label { font-weight: 600; color: #64748b; }
            .details-value { font-weight: 500; color: #0f172a; text-align: right; }
            .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
            .button { display: inline-block; background-color: ${this.brandColor}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 20px; }
            @media only screen and (max-width: 600px) {
              .container { margin: 0; border-radius: 0; }
              .content { padding: 20px; }
            }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>${this.senderName}</h1>
              </div>
              <div class="content">
                  ${content}
              </div>
              <div class="footer">
                  <p>&copy; ${year} ${this.senderName}. All rights reserved.</p>
                  <p>This email was sent to you because you have an account or appointment with us.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  async sendVerificationEmail(
    clientName: string,
    recipientEmail: string,
    code: string,
    expirationTime: number,
  ): Promise<boolean> {
    const subject = 'Verify Your Email Address';
    const content = `
      <h2>Welcome, ${clientName}!</h2>
      <p>Thank you for signing up. To complete your registration and verify your email address, please use the verification code below:</p>
      <div class="code-block">
        <span class="code">${code}</span>
      </div>
      <p>This code will expire in <strong>${expirationTime} minutes</strong>.</p>
      <p>If you did not create an account with us, you can safely ignore this email.</p>
    `;

    const htmlBody = this.getEmailTemplate(subject, content);
    const textBody = `Hello ${clientName},\n\nYour verification code is: ${code}\n\nExpires in ${expirationTime} minutes.`;

    return this.sendMailSafe(
      recipientEmail,
      subject,
      textBody,
      htmlBody,
      clientName,
    );
  }

  async sendResetPasswordEmail(
    clientName: string,
    recipientEmail: string,
    code: string,
    expirationTime: number,
  ): Promise<boolean> {
    const subject = 'Reset Your Password';
    const content = `
      <h2>Password Reset Request</h2>
      <p>Hello ${clientName},</p>
      <p>We received a request to reset the password for your account. Use the code below to proceed:</p>
      <div class="code-block">
        <span class="code">${code}</span>
      </div>
      <p>This code is valid for <strong>${expirationTime} minutes</strong>.</p>
      <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
    `;

    const htmlBody = this.getEmailTemplate(subject, content);
    const textBody = `Hello ${clientName},\n\nYour password reset code is: ${code}\n\nExpires in ${expirationTime} minutes.`;

    return this.sendMailSafe(
      recipientEmail,
      subject,
      textBody,
      htmlBody,
      clientName,
    );
  }

  async sendAppointmentConfirmationEmailToClient(
    recipientEmail: string,
    appointmentDetails: AppointmentDetailsDto,
  ): Promise<void> {
    const subject = 'Appointment Confirmed';
    const {
      clientName,
      staffName,
      appointmentDate,
      appointmentTime,
      location,
      serviceName,
      meetingLink,
    } = appointmentDetails;

    const content = `
      <h2>Appointment Confirmed</h2>
      <p>Dear ${clientName},</p>
      <p>Your appointment with <strong>${staffName}</strong> has been successfully booked.</p>
      
      <div class="details-box">
        <ul class="details-list">
          <li><span class="details-label">Date</span><span class="details-value">${appointmentDate}</span></li>
          <li><span class="details-label">Time</span><span class="details-value">${appointmentTime}</span></li>
          <li><span class="details-label">Service</span><span class="details-value">${serviceName}</span></li>
          <li><span class="details-label">Location</span><span class="details-value">${location}</span></li>
        </ul>
      </div>

      ${meetingLink ? `<p style="text-align: center;"><a href="${meetingLink}" class="button">Join Meeting</a></p>` : ''}
      
      <p>We look forward to seeing you!</p>
    `;

    const htmlBody = this.getEmailTemplate(subject, content);
    const textBody = `Appointment Confirmed\n\nDate: ${appointmentDate}\nTime: ${appointmentTime}\nService: ${serviceName}\nLocation: ${location}`;

    await this.sendMailSafe(
      recipientEmail,
      subject,
      textBody,
      htmlBody,
      clientName,
    );
  }

  async sendAppointmentConfirmationEmailToStaff(
    recipientEmail: string,
    appointmentDetails: AppointmentDetailsDto,
  ): Promise<void> {
    const {
      clientName,
      clientEmail,
      clientPhoneNumber,
      staffName,
      appointmentDate,
      appointmentTime,
      location,
      serviceName,
      meetingLink,
    } = appointmentDetails;

    const subject = 'New Appointment Scheduled';
    const content = `
      <h2>New Appointment</h2>
      <p>Hello ${staffName},</p>
      <p>You have a new appointment scheduled with <strong>${clientName}</strong>.</p>
      
      <div class="details-box">
        <ul class="details-list">
          <li><span class="details-label">Date</span><span class="details-value">${appointmentDate}</span></li>
          <li><span class="details-label">Time</span><span class="details-value">${appointmentTime}</span></li>
          <li><span class="details-label">Service</span><span class="details-value">${serviceName}</span></li>
          <li><span class="details-label">Client Email</span><span class="details-value">${clientEmail}</span></li>
          <li><span class="details-label">Client Phone</span><span class="details-value">${clientPhoneNumber}</span></li>
          <li><span class="details-label">Location</span><span class="details-value">${location}</span></li>
        </ul>
      </div>

      ${meetingLink ? `<p style="text-align: center;"><a href="${meetingLink}" class="button">Join Meeting</a></p>` : ''}
    `;

    const htmlBody = this.getEmailTemplate(subject, content);
    const textBody = `New Appointment\n\nClient: ${clientName}\nDate: ${appointmentDate}\nTime: ${appointmentTime}\nService: ${serviceName}`;

    await this.sendMailSafe(
      recipientEmail,
      subject,
      textBody,
      htmlBody,
      clientName,
    );
  }

  async sendCancellationEmail(
    appointment: AppointmentDetailsDto,
  ): Promise<void> {
    const {
      clientName,
      clientEmail,
      staffName,
      appointmentDate,
      appointmentTime,
      serviceName,
    } = appointment;
    const subject = 'Appointment Cancelled';

    const content = `
      <h2 style="color: #ef4444;">Appointment Cancelled</h2>
      <p>Dear ${clientName},</p>
      <p>We regret to inform you that your appointment has been cancelled.</p>
      
      <div class="details-box">
        <ul class="details-list">
          <li><span class="details-label">Staff</span><span class="details-value">${staffName}</span></li>
          <li><span class="details-label">Date</span><span class="details-value">${appointmentDate}</span></li>
          <li><span class="details-label">Time</span><span class="details-value">${appointmentTime}</span></li>
          <li><span class="details-label">Service</span><span class="details-value">${serviceName}</span></li>
        </ul>
      </div>
      
      <p>If you have any questions or would like to reschedule, please contact us.</p>
      <p>We apologize for the inconvenience.</p>
    `;

    const htmlBody = this.getEmailTemplate(subject, content);
    const textBody = `Appointment Cancelled\n\nYour appointment with ${staffName} on ${appointmentDate} at ${appointmentTime} has been cancelled.`;

    await this.sendMailSafe(
      clientEmail,
      subject,
      textBody,
      htmlBody,
      clientName,
    );
  }

  private async sendMailSafe(
    to: string,
    subject: string,
    text: string,
    html: string,
    clientName?: string,
  ): Promise<boolean> {
    const mailOptions: SendMailOptions = {
      clientName: clientName || '',
      to,
      subject,
      text,
      html,
    };

    try {
      await this.mailService.sendMail(mailOptions);
      this.logger.log(
        `Email sent successfully to: ${to} | Subject: ${subject}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${to}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
