import nodemailer from "nodemailer";

function smtpTransport(config: { host: string; port: number; user: string }, password: string) {
  if (config.host !== "smtp.ionos.co.uk" || ![465, 587].includes(config.port) || !config.user) throw new Error("Unsupported SMTP connection");
  return nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.port === 465, requireTLS: true,
    auth: { user: config.user, pass: password },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    tls: { rejectUnauthorized: true }, disableFileAccess: true, disableUrlAccess: true,
  });
}

export async function verifyContactSmtp(config: { host: string; port: number; user: string }, password: string) {
  const transport = smtpTransport(config, password);
  try { await transport.verify(); } finally { transport.close(); }
}

export async function sendContactSmtp(payload: unknown, id: string, password: string, connection: unknown) {
  const config = connection as { host?: string; port?: number; user?: string } | null;
  const message = payload as { from?: string; to?: string[]; bcc?: string[]; subject?: string; text?: string } | null;
  // Only the reviewed IONOS endpoint is supported initially. No request-controlled hosts/URLs.
  if (config?.host !== "smtp.ionos.co.uk" || ![465, 587].includes(config.port ?? 0) || !config.user ||
    !message?.from?.endsWith(`<${config.user}>`) || !message.to?.length || !message.subject || !message.text) {
    throw new Error("Invalid saved SMTP configuration");
  }
  const transport = smtpTransport({ host: config.host, port: config.port!, user: config.user }, password);
  try {
    const sent = await transport.sendMail({
      from: { name: message.from.slice(0, message.from.lastIndexOf(" <")), address: config.user },
      to: message.to, bcc: message.bcc,
      subject: message.subject, text: message.text,
      messageId: `<${id}@${config.user.split("@")[1]}>`,
    });
    // Partial recipient acceptance is not safe to resend (including a rejected BCC).
    if (sent.rejected?.length || !sent.accepted?.length || !sent.messageId) throw new Error("SMTP receipt needs review");
    return { id: sent.messageId };
  } finally {
    transport.close();
  }
}
