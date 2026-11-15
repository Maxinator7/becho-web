/** Details of the last verification code we sent, kept so /verify survives a reload. */
export interface OtpInfo {
  otpSentTo?: string;
  verificationMessage?: string;
  devOtp?: string;
  /** ms timestamp when the code was sent (drives the resend countdown). */
  sentAt?: number;
}

const KEY = 'becho:otp';

export function saveOtpInfo(info: OtpInfo) {
  try { sessionStorage.setItem(KEY, JSON.stringify(info)); } catch { /* storage unavailable */ }
}

export function loadOtpInfo(): OtpInfo | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OtpInfo) : null;
  } catch {
    return null;
  }
}

export function clearOtpInfo() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** Seconds left of the 60 s resend cooldown for a code sent at `sentAt`. */
export function cooldownLeft(sentAt?: number, seconds = 60) {
  if (!sentAt) return 0;
  return Math.max(0, Math.ceil(seconds - (Date.now() - sentAt) / 1000));
}
