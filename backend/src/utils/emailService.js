const nodemailer = require('nodemailer');

/**
 * Creates a nodemailer transporter configured with Gmail SMTP.
 * Loads credentials dynamically from environment variables.
 */
const createTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;

  if (!user || !pass) {
    console.error('Email credentials missing in environment variables. EMAIL_USER or EMAIL_APP_PASSWORD not set.');
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: user,
      pass: pass
    }
  });
};

/**
 * Sends a 6-digit OTP to the registered email address.
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<any>}
 */
const sendOTPEmail = async (toEmail, otp) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: `"Noble High School System" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Noble High School - Admin Portal Verification Code',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <div style="background: #1a3a6b; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">NOBLE HIGH SCHOOL</h2>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #c8a951; font-weight: 700; text-transform: uppercase;">Admin Verification</p>
        </div>
        <div style="padding: 24px; background: white; color: #333; line-height: 1.6;">
          <p style="margin-top: 0; font-size: 15px;">Hello Admin,</p>
          <p style="font-size: 15px;">A request has been made to log in to the Noble High School Admin Portal. Please use the following 6-digit One-Time Password (OTP) to complete your verification:</p>
          
          <div style="background: #f7f9fc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; text-align: center; margin: 24px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a3a6b; display: inline-block;">${otp}</span>
          </div>
          
          <p style="font-size: 13px; color: #718096; margin-bottom: 0;">This OTP is valid for 5 minutes. If you did not request this login attempt, please secure your password immediately.</p>
        </div>
        <div style="background: #f7f9fc; border-top: 1px solid #e2e8f0; padding: 15px; text-align: center; font-size: 11px; color: #718096;">
          This is an automated system message. Please do not reply directly to this email.
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`OTP email sent successfully to ${toEmail}. MessageID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    throw error;
  }
};

module.exports = {
  sendOTPEmail
};
