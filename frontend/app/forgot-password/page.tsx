'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HeroPanel } from '@/components/HeroPanel';
import { Field } from '@/components/Field';
import { OtpBoxes } from '@/components/OtpBoxes';
import { forgotPassword, resetPassword, ApiError } from '@/lib/api';

type Step = 'phone' | 'reset' | 'success';

const LOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const PHONE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

function formatPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 11);
  return digits.length > 4 ? digits.slice(0, 4) + '-' + digits.slice(4) : digits;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await forgotPassword(phone);
      setStep('reset');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send reset code.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    setError('');
    try {
      await forgotPassword(phone);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend code.');
    } finally {
      setResending(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (otp.length < 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await resetPassword(phone, otp, newPassword);
      setStep('success');
      setTimeout(() => router.push('/login'), 2200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <HeroPanel
        heading="Forgot Your"
        highlight="Password?"
        lede="Enter the phone number on your account and we'll send you a code to reset it."
      />

      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-page">
        <div className="bg-white rounded-card shadow-card w-full max-w-[460px] px-8 md:px-10 pt-9 pb-8">
          {step === 'phone' && (
            <>
              <div className="flex gap-4 items-start mb-6">
                <div className="w-[52px] h-[52px] rounded-full bg-navy flex items-center justify-center flex-none text-white">
                  {LOCK_ICON}
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold m-0">
                    Reset <span className="text-[#db2203]">Password</span>
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1 m-0">We'll text you a reset code</p>
                </div>
              </div>

              <form onSubmit={handleRequestCode} noValidate>
                <Field
                  id="phone"
                  type="tel"
                  label="Phone Number"
                  icon={PHONE_ICON}
                  placeholder="e.g. 03001234567"
                  required
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                />
                {error && <p className="text-sm text-[#db2203] mb-4">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-navy hover:bg-navy-light text-white font-bold text-[0.9rem] py-3.5 rounded-[10px] disabled:opacity-60 transition-colors"
                >
                  {submitting ? 'Sending code…' : 'Send Reset Code'}
                </button>
              </form>

              <p className="text-center mt-6 text-sm text-muted-foreground">
                Remembered your password?{' '}
                <Link href="/login" className="text-[#db2203] font-bold no-underline">
                  Log in
                </Link>
              </p>
            </>
          )}

          {step === 'reset' && (
            <>
              <div className="flex gap-4 items-start mb-6">
                <div className="w-[52px] h-[52px] rounded-full bg-navy flex items-center justify-center flex-none text-white">
                  {LOCK_ICON}
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold m-0">
                    Enter <span className="text-[#db2203]">Reset Code</span>
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1 m-0">
                    If <b className="text-ink">{phone}</b> is registered, a code was sent to it.
                  </p>
                </div>
              </div>

              <form onSubmit={handleReset} noValidate>
                <OtpBoxes value={otp} onChange={setOtp} />

                <p className="text-sm text-muted-foreground my-4">
                  Didn&apos;t get the code?{' '}
                  <button type="button" onClick={handleResend} disabled={resending} className="text-[#db2203] font-bold bg-transparent p-0 disabled:opacity-60">
                    {resending ? 'Sending…' : 'Resend code'}
                  </button>
                </p>

                <Field
                  id="new_password"
                  type="password"
                  label="New Password"
                  icon={LOCK_ICON}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Field
                  id="confirm_password"
                  type="password"
                  label="Confirm New Password"
                  icon={LOCK_ICON}
                  placeholder="Re-enter new password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />

                {error && <p className="text-sm text-[#db2203] mb-4">{error}</p>}

                <button
                  type="submit"
                  disabled={submitting || otp.length < 6}
                  className="w-full bg-navy hover:bg-navy-light text-white font-bold text-[0.9rem] py-3.5 rounded-[10px] disabled:opacity-60 transition-colors"
                >
                  {submitting ? 'Resetting…' : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-8 px-2">
              <div className="w-[90px] h-[90px] rounded-full border-[3px] border-success flex items-center justify-center mx-auto mb-5 text-success text-4xl">
                ✓
              </div>
              <h2 className="font-display text-xl font-bold mb-2">Password reset</h2>
              <p className="text-muted-foreground max-w-[36ch] mx-auto">Taking you to the login page…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
