const https = require('https');
const nodemailer = require('nodemailer');

const sendOTPEmail = async (toEmail, otp) => {
  // Always log OTP to console for developer/localhost bypass
  console.log(`\n======================================================`);
  console.log(`[DEVELOPER OTP BYPASS] Generated OTP for Admin: ${otp}`);
  console.log(`======================================================\n`);

  const apiKey = process.env.RESEND_API_KEY;
  const smtpUser = process.env.EMAIL_USER;
  const smtpPass = process.env.EMAIL_APP_PASSWORD;

  // 1. Try Resend API if apiKey is configured
  if (apiKey) {
    try {
      console.log('Attempting to send OTP email via Resend API...');
      const emailData = JSON.stringify({
        from: 'Noble High School <onboarding@resend.dev>',
        to: [toEmail],
        subject: 'Noble High School - Admin Portal Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background: #1a3a6b; color: white; padding: 20px; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">NOBLE HIGH SCHOOL</h2>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #c8a951;">Admin Verification</p>
            </div>
            <div style="padding: 24px; background: white; color: #333;">
              <p>Hello Admin,</p>
              <p>Use the following OTP to complete your login:</p>
              <div style="background: #f7f9fc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; text-align: center; margin: 24px 0;">
                <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a3a6b;">${otp}</span>
              </div>
              <p style="font-size: 13px; color: #718096;">This OTP is valid for 5 minutes.</p>
            </div>
          </div>
        `
      });

      await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.resend.com',
          path: '/emails',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(emailData)
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            const parsed = JSON.parse(data);
            if (res.statusCode === 200 || res.statusCode === 201) {
              console.log(`OTP email sent successfully to ${toEmail} via Resend. ID: ${parsed.id}`);
              resolve(parsed);
            } else {
              reject(new Error(`Resend API error: ${data}`));
            }
          });
        });

        req.on('error', (err) => reject(err));
        req.write(emailData);
        req.end();
      });
      return; // Successfully sent
    } catch (resendError) {
      console.warn(`[Resend Warning] Failed to send via Resend: ${resendError.message}`);
      // Fall through to SMTP if SMTP is configured
    }
  }

  // 2. Try Nodemailer / SMTP (Gmail or custom host) if credentials exist
  if (smtpUser && smtpPass) {
    try {
      console.log('Attempting to send OTP email via SMTP...');
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: process.env.EMAIL_SECURE === 'true', // false by default for 587
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const mailOptions = {
        from: `"Noble High School System" <${smtpUser}>`,
        to: toEmail,
        subject: 'Noble High School - Admin Portal Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background: #1a3a6b; color: white; padding: 20px; text-align: center;">
              <h2 style="margin: 0; font-size: 20px;">NOBLE HIGH SCHOOL</h2>
              <p style="margin: 5px 0 0 0; font-size: 13px; color: #c8a951;">Admin Verification</p>
            </div>
            <div style="padding: 24px; background: white; color: #333;">
              <p>Hello Admin,</p>
              <p>Use the following OTP to complete your login:</p>
              <div style="background: #f7f9fc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; text-align: center; margin: 24px 0;">
                <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a3a6b;">${otp}</span>
              </div>
              <p style="font-size: 13px; color: #718096;">This OTP is valid for 5 minutes.</p>
            </div>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`OTP email sent successfully to ${toEmail} via SMTP. MessageID: ${info.messageId}`);
      return info;
    } catch (smtpError) {
      console.warn(`[SMTP Warning] Failed to send via SMTP: ${smtpError.message}`);
    }
  }

  // 3. Fallback: If both Resend and SMTP failed (or are not configured), we do NOT throw an error.
  // We log it and let the developer log in using the printed OTP.
  console.log(`\n[OTP BYPASS ACTIVE] Could not send OTP email to ${toEmail}.`);
  console.log(`Please use the OTP displayed above in the terminal console to complete the login on localhost.\n`);
};

module.exports = { sendOTPEmail };
