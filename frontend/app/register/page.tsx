'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HeroPanel } from '@/components/HeroPanel';
import { Field } from '@/components/Field';
import { OtpBoxes } from '@/components/OtpBoxes';
import { registerUser, verifyOtp, sendOtp, ApiError } from '@/lib/api';

type Step = 'form' | 'otp' | 'success';

const USER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);
const MAIL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" />
  </svg>
);
const PHONE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const LOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', cnic: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (form.password !== form.confirm) {
      nextErrors.confirm = "Passwords don't match.";
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      await registerUser({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        cnic: form.cnic,
        password: form.password,
      });
      setStep('otp');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ form: err.message });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    if (otp.length < 6) return;
    try {
      await verifyOtp(form.phone, otp);
      setStep('success');
      setTimeout(() => router.push('/login'), 2200);
    } catch (err) {
      setOtpError(err instanceof ApiError ? err.message : 'Verification failed.');
    }
  }

  async function handleResend() {
    setOtpError('');
    setOtp('');
    try {
      await sendOtp(form.phone);
    } catch (err) {
      setOtpError(err instanceof ApiError ? err.message : 'Could not resend code.');
    }
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <HeroPanel
        heading="Join FastEx."
        highlight="Ship Smarter."
        lede="Create your account to start booking pickups, tracking deliveries, and managing your shipments in one place."
      />

      <div className="flex-1 flex items-center justify-center px-6 py-10 bg-page">
        <div className="bg-white rounded-card shadow-card w-full max-w-[460px] px-8 md:px-10 pt-9 pb-8">
          {step === 'form' && (
            <>
              <div className="flex gap-4 items-start mb-6">
                <div className="w-[52px] h-[52px] rounded-full bg-navy flex items-center justify-center flex-none text-white">
                  {USER_ICON}
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold m-0">
                    Create <span className="text-orange">Your Account</span>
                  </h2>
                  <p className="text-muted text-sm mt-1 m-0">Book your first shipment in minutes</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <Field
                  id="full_name"
                  label="Full Name"
                  icon={USER_ICON}
                  placeholder="Enter your full name"
                  required
                  value={form.full_name}
                  onChange={(e) => updateField('full_name', e.target.value)}
                />
                <Field
                  id="email"
                  type="email"
                  label="Email Address"
                  icon={MAIL_ICON}
                  placeholder="Enter your email"
                  required
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                />
                <Field
                  id="phone"
                  type="tel"
                  label="Phone Number"
                  icon={PHONE_ICON}
                  placeholder="e.g. 03001234567"
                  required
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                />
                <Field
                  id="cnic"
                  type="tel"
                  label="CNIC"
                  icon={null}
                  placeholder='e.g 1620434324'
                  // required
                  value={form.cnic}
                  onChange={(e) => updateField('cnic', e.target.value)}/>
                <Field
                  id="password"
                  type="password"
                  label="Password"
                  icon={LOCK_ICON}
                  placeholder="Create a password"
                  minLength={8}
                  required
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                />
                <Field
                  id="confirm"
                  type="password"
                  label="Confirm Password"
                  icon={LOCK_ICON}
                  placeholder="Confirm your password"
                  required
                  error={errors.confirm}
                  value={form.confirm}
                  onChange={(e) => updateField('confirm', e.target.value)}
                />

                {errors.form && <p className="text-sm text-danger mb-4">{errors.form}</p>}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-navy hover:bg-navy-light text-white font-bold text-[0.9rem] py-3.5 rounded-[10px] disabled:opacity-60 transition-colors"
                >
                  {submitting ? 'Creating account…' : 'Create Account'}
                </button>
              </form>

              <p className="text-center mt-6 text-sm text-muted">
                Already have an account?{' '}
                <Link href="/login" className="text-orange font-bold no-underline">
                  Login
                </Link>
              </p>
            </>
          )}

          {step === 'otp' && (
            <>
              <div className="flex gap-4 items-start mb-6">
                <div className="w-[52px] h-[52px] rounded-full bg-navy flex items-center justify-center flex-none text-white">
                  {LOCK_ICON}
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold m-0">
                    Verify <span className="text-orange">Your Phone</span>
                  </h2>
                  <p className="text-muted text-sm mt-1 m-0">Enter the code we just sent you</p>
                </div>
              </div>

              <p className="text-sm text-muted mb-5 leading-relaxed">
                Code sent to <b className="text-ink">{form.phone}</b>. Check your server console for the
                stub SMS output during development.
              </p>

              <OtpBoxes value={otp} onChange={setOtp} />
              {otpError && <p className="text-[0.74rem] text-danger mb-4">{otpError}</p>}

              <p className="text-sm text-muted mb-5">
                Didn&apos;t get the code?{' '}
                <button onClick={handleResend} className="text-orange font-bold bg-transparent p-0">
                  Resend code
                </button>
              </p>

              <button
                onClick={handleVerify}
                className="w-full bg-navy hover:bg-navy-light text-white font-bold text-[0.9rem] py-3.5 rounded-[10px] transition-colors"
              >
                Verify &amp; Continue ✓
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-8 px-2">
              <div className="w-[90px] h-[90px] rounded-full border-[3px] border-success flex items-center justify-center mx-auto mb-5 text-success text-4xl">
                ✓
              </div>
              <h2 className="font-display text-xl font-bold mb-2">Account created</h2>
              <p className="text-muted max-w-[36ch] mx-auto">Taking you to the login page…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
