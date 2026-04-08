export async function sendWelcomeEmail(email: string, fullName: string) {
  console.log(`[EMAIL] Welcome sent to ${email} (${fullName}).`);
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  console.log(`[EMAIL] Password reset for ${email}: ${resetUrl}`);
}
