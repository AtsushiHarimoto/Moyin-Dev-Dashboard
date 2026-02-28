import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set env vars before importing the module (it reads them at top level)
process.env.GMAIL_USER = 'testuser@gmail.com';
process.env.GMAIL_APP_PASSWORD = 'fake-app-password';
process.env.GMAIL_TO = 'recipient@gmail.com';
process.env.GMAIL_OVERRIDES = '{"AI量化交易":"quant@gmail.com,boss@gmail.com"}';

// Mock nodemailer
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-123' });
vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({ sendMail: mockSendMail }),
  },
}));

const { getEmailStatus, sendReport, sendTestEmail, resolveRecipient } = await import('../email');

beforeEach(() => {
  mockSendMail.mockClear();
});

describe('getEmailStatus', () => {
  it('returns configured status when env vars are set', () => {
    const status = getEmailStatus();
    expect(status.configured).toBe(true);
    expect(status).toHaveProperty('from');
    expect(status).toHaveProperty('to');
    expect(status).toHaveProperty('toCount');
    expect(status.toCount).toBe(1);
  });
});

describe('sendReport', () => {
  it('calls sendMail with correct subject and attachment', async () => {
    await sendReport('VibeCoding', '# Report\nContent here', 'test@gmail.com');
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('[Moyin] VibeCoding');
    expect(call.subject).toContain('趨勢報告');
    expect(call.attachments).toHaveLength(1);
    expect(call.attachments[0].filename).toContain('VibeCoding');
  });
});

describe('sendTestEmail', () => {
  it('sends a test email', async () => {
    await sendTestEmail('test@gmail.com');
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0].subject).toContain('測試');
  });
});

describe('resolveRecipient', () => {
  it('returns explicit to when provided', () => {
    expect(resolveRecipient('AI量化交易', 'custom@gmail.com')).toBe('custom@gmail.com');
  });

  it('returns override for matching label', () => {
    expect(resolveRecipient('AI量化交易')).toBe('quant@gmail.com,boss@gmail.com');
  });

  it('falls back to GMAIL_TO for non-overridden label', () => {
    expect(resolveRecipient('VibeCoding')).toBe('recipient@gmail.com');
  });
});

describe('getEmailStatus overrides', () => {
  it('returns masked overrides', () => {
    const status = getEmailStatus();
    expect(status.overrides).toBeDefined();
    expect(status.overrides['AI量化交易']).toContain('qua***@gmail.com');
  });
});

describe('sendReport with override', () => {
  it('sends to overridden recipient for matching label', async () => {
    await sendReport('AI量化交易', '# Report');
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('quant@gmail.com,boss@gmail.com');
  });
});
