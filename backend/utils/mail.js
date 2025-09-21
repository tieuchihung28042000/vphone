import nodemailer from 'nodemailer';

// Mock email function for testing
export const sendResetPasswordEmail = async (email, resetToken) => {
  console.log(`Mock email sent to ${email} with token: ${resetToken}`);
  return true;
};