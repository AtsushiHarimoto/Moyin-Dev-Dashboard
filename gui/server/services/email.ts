/**
 * Email Service — nodemailer + Gmail App Password
 * Credentials from environment: GMAIL_USER, GMAIL_APP_PASSWORD, GMAIL_TO
 * Per-category overrides: GMAIL_OVERRIDES (JSON: { "label": "to1@x.com,to2@x.com" })
 */

import nodemailer from 'nodemailer';
import { marked } from 'marked';

const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || '';
const GMAIL_TO = process.env.GMAIL_TO || '';

function parseOverrides(): Record<string, string> {
  const raw = process.env.GMAIL_OVERRIDES || '';
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

const GMAIL_OVERRIDES = parseOverrides();

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

let sharedTransport: ReturnType<typeof createTransport> | null = null;

function getOrCreateTransport() {
  if (!sharedTransport) {
    sharedTransport = createTransport();
  }
  return sharedTransport;
}

export function closeEmailTransport(): void {
  if (sharedTransport) {
    sharedTransport.close();
    sharedTransport = null;
  }
}

function maskEmail(email: string): string {
  const trimmed = email.trim();
  const [user, domain] = trimmed.split('@');
  if (!user || !domain) return '***';
  return `${user.slice(0, 3)}***@${domain}`;
}

function maskEmails(emails: string): string {
  return emails.split(',').map(maskEmail).join(', ');
}

export interface EmailStatus {
  configured: boolean;
  from: string;
  to: string;
  toCount: number;
  overrides: Record<string, string>;
}

export function getEmailStatus(): EmailStatus {
  const configured = Boolean(GMAIL_USER && GMAIL_APP_PASSWORD && GMAIL_TO);
  const toList = GMAIL_TO.split(',').map((e) => e.trim()).filter(Boolean);
  const maskedOverrides: Record<string, string> = {};
  for (const [label, emails] of Object.entries(GMAIL_OVERRIDES)) {
    maskedOverrides[label] = maskEmails(emails);
  }
  return {
    configured,
    from: configured ? maskEmail(GMAIL_USER) : '',
    to: configured ? maskEmails(GMAIL_TO) : '',
    toCount: toList.length,
    overrides: maskedOverrides,
  };
}

export function isEmailConfigured(): boolean {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD && GMAIL_TO);
}

export function resolveRecipient(label: string, to?: string): string {
  return to || GMAIL_OVERRIDES[label] || GMAIL_TO;
}

export async function sendReport(label: string, reportMd: string, to?: string): Promise<void> {
  const recipient = resolveRecipient(label, to);
  if (!recipient || !GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  const date = new Date().toISOString().slice(0, 10);
  const html = await marked(reportMd);

  const transport = getOrCreateTransport();
  await transport.sendMail({
    from: `Moyin <${GMAIL_USER}>`,
    to: recipient,
    subject: `[Moyin] ${label} 趨勢報告 — ${date}`,
    html,
    attachments: [
      {
        filename: `${label}_${date}.md`,
        content: reportMd,
        contentType: 'text/markdown',
      },
    ],
  });
}

export async function sendTestEmail(to?: string): Promise<void> {
  const recipient = to || GMAIL_TO;
  if (!recipient || !GMAIL_USER || !GMAIL_APP_PASSWORD) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }

  const transport = createTransport();
  await transport.sendMail({
    from: `Moyin <${GMAIL_USER}>`,
    to: recipient,
    subject: `[Moyin] 測試郵件 — ${new Date().toISOString().slice(0, 16)}`,
    html: '<h2>Moyin Email 配置成功</h2><p>此為測試郵件，您的 Gmail App Password 配置正確。</p>',
  });
}
