'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Field } from '@/components/Field';
import { OtpBoxes } from '@/components/OtpBoxes';
import next from 'next';
import { ApiError, registerBusinessUser } from '@/lib/api';

// ============================================================
// TYPES & CONSTANTS
// ============================================================

interface FormState {
  fullName: string;
  location: string;
  sellerEmail: string;
  phone: string;
  password: string;
  confirmPassword: string;
  cnic: string;
  businessName: string;
  businessType: string;
  regNumber: string;
  ntn: string;
  monthlyShipments: string;
  businessAddress: string;
  pickupAddress: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  pickupTiming: string;
  codRequired: boolean;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  acceptTerms: boolean;
  prefferedPickupTime: string;
  estimatedMonthlyShipments: string;
}

const INITIAL_FORM: FormState = {
  fullName: '', location: '', estimatedMonthlyShipments: '', prefferedPickupTime: '', sellerEmail: '', phone: '', password: '', confirmPassword: '', cnic: '',
  businessName: '', businessType: '', regNumber: '', ntn: '', monthlyShipments: '',
  businessAddress: '', pickupAddress: '', city: '', province: '', postalCode: '', country: '', pickupTiming: '',
  codRequired: false, bankName: '', accountTitle: '', accountNumber: '', acceptTerms: false,
};

const STEP_NAMES: Record<number, string> = { 1: 'Seller Details', 2: 'Business Information', 3: 'Address & Payouts', 4: 'Verify Email' };

const BUSINESS_TYPES = [
  'E-commerce Store', 'Retail Store', 'Wholesale Business', 'Manufacturer', 'Distributor', 'Pharmacy',
  'Grocery & Supermarket', 'Restaurant & Bakery', 'Fashion & Apparel', 'Electronics', 'Beauty & Cosmetics',
  'Home & Furniture', 'Books & Stationery', 'Automotive Parts', 'Health & Fitness',
  'Documents & Legal Services', 'Importer / Exporter', 'Individual Seller', 'Other',
];
const SHIPMENT_RANGES = ['1-20', '21-50', '51-200', '201-500', '500+'];

// ============================================================
// ICONS
// ============================================================
const ICONS = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  pin: <><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 6 10 7 10-7" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 3a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.2-1.3a2 2 0 0 1 2.1-.5c1 .3 2 .5 3 .7a2 2 0 0 1 1.7 2z" />,
  lock: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  idCard: <><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2.2" /><path d="M14 10h5M14 14h5" /></>,
  building: <><rect x="3" y="3" width="12" height="18" rx="1" /><path d="M15 8h6v13h-6M7 7h.01M11 7h.01M7 11h.01M11 11h.01M7 15h.01M11 15h.01" /></>,
  layers: <><path d="m21 8-9-6-9 6 9 6 9-6z" /><path d="M3 8v8l9 6 9-6V8" /></>,
  doc: <><path d="M9 12h6M9 16h6M9 8h6" /><rect x="4" y="3" width="16" height="18" rx="2" /></>,
  tax: <><path d="M4 4h16v16H4z" /><path d="M8 9h8M8 13h5" /></>,
  box: <><path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>,
  truck: <><rect x="1" y="6" width="15" height="11" /><path d="M16 10h4l3 3v4h-7z" /><circle cx="6" cy="18" r="2" /><circle cx="18.5" cy="18" r="2" /></>,
  city: <path d="M3 21V9l6-4 6 4v12M15 21v-8l6 4v4" />,
  map: <path d="M4 4h16v16H4zM4 10h16M10 4v16" />,
  mailbox: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7h18" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-6-3.8-9s1.3-6.4 3.8-9z" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  bank: <><path d="M3 10 12 4l9 6" /><path d="M4 10v10h16V10M9 14v4M15 14v4" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></>,
  fastDelivery: <><rect x="1" y="6" width="15" height="11" /><path d="M16 10h4l3 3v4h-7z" /><circle cx="6" cy="18" r="2" /><circle cx="18.5" cy="18" r="2" /></>,
  shield: <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />,
  worldwide: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-6-3.8-9s1.3-6.4 3.8-9z" /></>,
  support: <><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3z" /><path d="M3 19a2 2 0 0 0 2 2h1v-6H3z" /></>,
};

function Icon({ path, size = 18 }: { path: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {path}
    </svg>
  );
}

// ============================================================
// SMALL LOCAL COMPONENTS (Field doesn't support selects or trailing buttons)
// ============================================================

function SelectField({
  label, icon, error, value, onChange, options, id,
}: { label: string; icon: React.ReactNode; error?: string; value: string; onChange: (v: string) => void; options: string[]; id: string }) {
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.82rem] font-semibold text-ink">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none z-10">
          {icon}
        </span>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full appearance-none text-[0.92rem] py-3 pl-[42px] pr-8 rounded-[10px] border-[1.5px] bg-[#FBFCFE] text-ink outline-none transition-colors
            focus:border-orange focus:bg-white focus:shadow-[0_0_0_3px_rgba(242,112,26,0.13)]
            ${error ? 'border-danger shadow-[0_0_0_3px_rgba(216,67,44,0.12)]' : 'border-line'}`}
        >
          <option value="" disabled>Select an option</option>
          {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
      {error && <span className="text-[0.74rem] text-danger">{error}</span>}
    </div>
  );
}

function PasswordField({
  label, icon, error, value, onChange, placeholder, id,
}: { label: string; icon: React.ReactNode; error?: string; value: string; onChange: (v: string) => void; placeholder: string; id: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="mb-4 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.82rem] font-semibold text-ink">{label}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-muted pointer-events-none">{icon}</span>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full text-[0.92rem] py-3 pl-[42px] pr-10 rounded-[10px] border-[1.5px] bg-[#FBFCFE] text-ink outline-none transition-colors
            focus:border-orange focus:bg-white focus:shadow-[0_0_0_3px_rgba(242,112,26,0.13)]
            ${error ? 'border-danger shadow-[0_0_0_3px_rgba(216,67,44,0.12)]' : 'border-line'}`}
        />
        <button type="button" onClick={() => setVisible((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted" aria-label="Toggle password visibility">
          <Icon path={ICONS.eye} />
        </button>
      </div>
      {error && <span className="text-[0.74rem] text-danger">{error}</span>}
    </div>
  );
}

// ============================================================
// VALIDATION
// ============================================================

function validateStep(step: number, form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cnicRe = /^\d{5}-\d{7}-\d{1}$/;

  if (step === 1) {
    if (!form.fullName.trim()) errors.fullName = 'Enter your full name.';
    if (!form.location.trim()) errors.location = 'Enter your location.';
    if (!emailRe.test(form.sellerEmail)) errors.sellerEmail = 'Enter a valid email address.';
    if (!form.phone.trim()) errors.phone = 'Enter a valid phone number.';
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (form.confirmPassword !== form.password) errors.confirmPassword = "Passwords don't match.";
    if (!cnicRe.test(form.cnic)) errors.cnic = 'CNIC must be 13 digits, formatted as #####-#######-#.';
  }

  if (step === 2) {
    if (!form.businessName.trim()) errors.businessName = 'Enter your business name.';
    if (!form.businessType) errors.businessType = 'Select a business type.';
    if (!form.regNumber.trim()) errors.regNumber = 'Enter your registration number.';
    if (!form.monthlyShipments) errors.monthlyShipments = 'Select an estimated shipment range.';
  }

  if (step === 3) {
    if (!form.businessAddress.trim()) errors.businessAddress = 'Enter your business address.';
    if (!form.pickupAddress.trim()) errors.pickupAddress = 'Enter your pickup address.';
    if (!form.city.trim()) errors.city = 'Enter your city.';
    if (!form.province.trim()) errors.province = 'Enter your province or state.';
    if (!form.postalCode.trim()) errors.postalCode = 'Enter your postal code.';
    if (!form.country.trim()) errors.country = 'Enter your country.';
    if (!form.pickupTiming) errors.pickupTiming = 'Choose a preferred pickup time.';
    if (!form.bankName.trim()) errors.bankName = 'Enter your bank name.';
    if (!form.accountTitle.trim()) errors.accountTitle = 'Enter the account title.';
    if (!form.accountNumber.trim()) errors.accountNumber = 'Enter a valid account number or IBAN.';
    if (!form.acceptTerms) errors.acceptTerms = 'You must accept the Terms & Conditions to continue.';
  }

  return errors;
}

function formatCnic(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 13);
  let out = digits;
  if (digits.length > 5) out = digits.slice(0, 5) + '-' + digits.slice(5);
  if (digits.length > 12) out = out.slice(0, 13) + '-' + digits.slice(12);
  return out;
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const visible = user.slice(0, Math.min(2, user.length));
  return `${visible}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function BusinessSignupPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [refNum, setRefNum] = useState('');

  // OTP (demo mode - see note below)
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function goNext() {
    const stepErrors = validateStep(step, form);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    if (step === 3) {
      sendOtp();
      setStep(4);
    } else {
      setStep((s) => s + 1);
    }
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function sendOtp() {
    // DEMO MODE: the original mockup never sent a real email either - it
    // generated a code client-side and displayed it in a "demo hint" box.
    // Kept identical here rather than wiring to /auth/send-otp, because
    // this form collects business fields (NTN, bank details, registration
    // number, etc.) that don't exist anywhere on the backend's Business
    // model yet - pretending this saves real data would be misleading.
    // Once a real business-registration endpoint exists, replace this
    // with a call to it and use its OTP flow instead.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedOtp(code);
    setOtpValue('');
    setOtpError('');
    startResendTimer();
  }

  function updateField(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startResendTimer() {
    setResendSeconds(30);
    const interval = setInterval(() => {
      setResendSeconds((s) => {
        if (s <= 1) {
          clearInterval(interval);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: Record<string, string> = {}

    if(form.password !== form.confirmPassword){
        nextErrors.confirm = "Password don't match.";
    }

    if(Object.keys(nextErrors).length){
        setErrors(nextErrors);
        return;
    }

    try{

        await registerBusinessUser({
            full_name: form.fullName,
            email: form.sellerEmail,
            phone: form.phone,
            cnic: form.cnic,
            password: form.password,
            business_name: form.businessName,
            business_type: form.businessType,
            business_registration_number: form.regNumber,
            ntn: form.ntn, //n,tional tax number -> optional
            estimated_monthly_shipments: form.estimatedMonthlyShipments,
            business_address: form.businessAddress,
            pickup_address: form.pickupAddress,
            city: form.city,
            province: form.province,
            postal_code: form.postalCode,
            country: form.country,
            preffered_pickup_time: form.prefferedPickupTime,
            cod_service: form.codRequired,
            bank_name: form.bankName,
            account_title: form.accountTitle,
            account_number: form.accountNumber,

        });
    }catch(err){
        if(err instanceof ApiError){
            setErrors({form: err.message})
        }
    }

    if (otpValue.length < 6 || otpValue !== generatedOtp) {
      setOtpError("That code doesn't match. Please try again.");
      return;
    }
    setOtpError('');
    setRefNum(String(Math.floor(100000 + Math.random() * 899999)));
    setSubmitted(true);
  }

  const progressPct = (step / 4) * 100;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      {/* ============ HERO ============ */}
      <div className="lg:flex-[1.05] relative overflow-hidden px-7 md:px-14 pt-9 md:pt-13 flex flex-col bg-hero-gradient text-navy min-h-[280px] lg:min-h-screen">
        <div className="flex items-center gap-2.5 mb-10">
          <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
            <path d="M2 20 L24 20 L18 12 L34 20 L18 28 L24 20" fill="none" stroke="#F2701A" strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div>
            <div className="font-display text-2xl font-extrabold tracking-tight leading-none text-navy">FAST<span className="text-orange">EX</span></div>
            <div className="text-[0.62rem] tracking-[0.22em] text-muted font-semibold mt-0.5">COURIER SERVICES</div>
          </div>
        </div>

        <h1 className="font-display text-3xl md:text-4xl font-extrabold leading-tight mb-4 max-w-[480px]">
          Fast. Reliable.<br /><span className="text-orange">Delivered</span> with Care.
        </h1>
        <p className="text-base text-[#3A4A64] max-w-[420px] leading-relaxed mb-9">
          Join FastEx and grow your business with our trusted courier solutions.
        </p>

        <div className="flex flex-col gap-5 mb-10">
          {[
            { icon: ICONS.fastDelivery, bg: 'bg-navy', title: 'Fast Delivery', sub: 'On-time, every time' },
            { icon: ICONS.shield, bg: 'bg-orange', title: 'Safe & Secure', sub: 'We care for your parcel' },
            { icon: ICONS.worldwide, bg: 'bg-navy', title: 'Worldwide', sub: 'Delivering globally' },
            { icon: ICONS.support, bg: 'bg-orange', title: '24/7 Support', sub: "We're here to help" },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-3.5">
              <div className={`w-[46px] h-[46px] rounded-full flex-none flex items-center justify-center text-white ${f.bg}`}>
                <Icon path={f.icon} size={20} />
              </div>
              <div>
                <div className="font-bold text-[0.98rem] text-navy">{f.title}</div>
                <div className="text-[0.82rem] text-muted">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="relative mt-auto h-[230px] hidden md:block">
          <svg viewBox="0 0 600 230" preserveAspectRatio="none" className="absolute bottom-0 left-0 w-full h-full">
            <path d="M0 210 C150 150, 450 150, 600 210 L600 230 L0 230 Z" fill="#0F2648" opacity="0.06" />
            <path d="M0 214 C150 160, 450 160, 600 214" fill="none" stroke="#F2701A" strokeWidth="4" strokeLinecap="round" />
            <g opacity="0.5">
              <rect x="20" y="120" width="18" height="90" fill="#173868" />
              <rect x="46" y="95" width="22" height="115" fill="#0F2648" />
              <rect x="76" y="130" width="16" height="80" fill="#173868" />
              <rect x="500" y="110" width="20" height="100" fill="#0F2648" />
              <rect x="528" y="140" width="16" height="70" fill="#173868" />
              <rect x="552" y="100" width="22" height="110" fill="#0F2648" />
            </g>
            <g transform="translate(230,120)">
              <rect x="60" y="30" width="130" height="55" rx="6" fill="#fff" stroke="#0F2648" strokeWidth="3" />
              <path d="M60 30 h60 l30 25 v30 h-90 z" fill="#0F2648" />
              <rect x="95" y="40" width="30" height="18" rx="2" fill="#EAF1FC" />
              <circle cx="85" cy="88" r="12" fill="#16233D" />
              <circle cx="85" cy="88" r="5" fill="#CBD3DF" />
              <circle cx="165" cy="88" r="12" fill="#16233D" />
              <circle cx="165" cy="88" r="5" fill="#CBD3DF" />
              <text x="95" y="65" fontFamily="Poppins, sans-serif" fontWeight="700" fontSize="12" fill="#F2701A">FAST<tspan fill="#0F2648">EX</tspan></text>
              <rect x="0" y="60" width="42" height="35" fill="#C88A4E" />
              <rect x="6" y="66" width="30" height="8" fill="#F2701A" />
              <rect x="18" y="35" width="42" height="60" fill="#D69A5F" />
              <rect x="24" y="42" width="30" height="8" fill="#0F2648" />
            </g>
          </svg>
        </div>

        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2.5 py-5 md:py-6 border-t border-navy/10">
          {[['10K+', 'Parcels Delivered'], ['500+', 'Cities Covered'], ['5K+', 'Happy Customers'], ['24/7', 'Customer Support']].map(([num, label]) => (
            <div key={label}>
              <div className="text-orange font-extrabold text-lg font-display">{num}</div>
              <div className="text-muted text-[0.72rem]">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ============ FORM ============ */}
      <div className="flex-1 flex items-start justify-center px-6 py-10 bg-page">
        <div className="bg-white rounded-card shadow-card w-full max-w-[640px] px-8 md:px-10 pt-9 pb-8">
          {!submitted ? (
            <>
              <div className="flex gap-4 items-start mb-6">
                <div className="w-[52px] h-[52px] rounded-full bg-navy flex items-center justify-center flex-none text-white">
                  <Icon path={ICONS.support} size={24} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold m-0">Create <span className="text-orange">Your Account</span></h2>
                  <p className="text-muted text-sm mt-1 m-0">Sign up to get started with FastEx</p>
                </div>
              </div>

              <div className="mb-7">
                <div className="flex justify-between text-xs text-muted font-semibold mb-2">
                  <span>Step <b className="text-orange">{step}</b> of 4</span>
                  <span>{STEP_NAMES[step]}</span>
                </div>
                <div className="h-1.5 bg-line rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange to-orange-light rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                {step === 1 && (
                  <div className="grid sm:grid-cols-2 gap-x-5">
                    <Field id="fullName" label="Full Name *" icon={<Icon path={ICONS.user} />} placeholder="Enter your full name"
                      value={form.fullName} onChange={(e) => set('fullName', e.target.value)} error={errors.fullName} />
                    <Field id="location" label="Location *" icon={<Icon path={ICONS.pin} />} placeholder="City / area you're based in"
                      value={form.location} onChange={(e) => set('location', e.target.value)} error={errors.location} />
                    <Field id="sellerEmail" type="email" label="Email Address *" icon={<Icon path={ICONS.mail} />} placeholder="Enter your email"
                      value={form.sellerEmail} onChange={(e) => set('sellerEmail', e.target.value)} error={errors.sellerEmail} />
                    <Field id="phone" type="tel" label="Phone Number *" icon={<Icon path={ICONS.phone} />} placeholder="Enter your phone number"
                      value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} />
                    <PasswordField id="password" label="Password *" icon={<Icon path={ICONS.lock} />} placeholder="Create a password"
                      value={form.password} onChange={(v) => set('password', v)} error={errors.password} />
                    <PasswordField id="confirmPassword" label="Confirm Password *" icon={<Icon path={ICONS.lock} />} placeholder="Confirm your password"
                      value={form.confirmPassword} onChange={(v) => set('confirmPassword', v)} error={errors.confirmPassword} />
                    <div className="sm:col-span-2">
                      <Field id="cnic" label="CNIC Number *" icon={<Icon path={ICONS.idCard} />} placeholder="#####-#######-#" maxLength={15}
                        value={form.cnic} onChange={(e) => set('cnic', formatCnic(e.target.value))} error={errors.cnic} />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-x-5">
                      <Field id="businessName" label="Business Name *" icon={<Icon path={ICONS.building} />} placeholder="Enter your business name"
                        value={form.businessName} onChange={(e) => set('businessName', e.target.value)} error={errors.businessName} />
                      <SelectField id="businessType" label="Business Type *" icon={<Icon path={ICONS.layers} />}
                        value={form.businessType} onChange={(v) => set('businessType', v)} options={BUSINESS_TYPES} error={errors.businessType} />
                      <Field id="regNumber" label="Business Registration Number *" icon={<Icon path={ICONS.doc} />} placeholder="e.g. REG-00123456"
                        value={form.regNumber} onChange={(e) => set('regNumber', e.target.value)} error={errors.regNumber} />
                      <Field id="ntn" label="NTN (optional)" icon={<Icon path={ICONS.tax} />} placeholder="National Tax Number"
                        value={form.ntn} onChange={(e) => set('ntn', e.target.value)} />
                    </div>
                    <div className="max-w-[340px]">
                      <SelectField id="monthlyShipments" label="Estimated Monthly Shipments *" icon={<Icon path={ICONS.box} />}
                        value={form.monthlyShipments} onChange={(v) => set('monthlyShipments', v)} options={SHIPMENT_RANGES} error={errors.monthlyShipments} />
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <Field id="businessAddress" label="Business Address *" icon={<Icon path={ICONS.pin} />} placeholder="Enter your business address"
                      value={form.businessAddress} onChange={(e) => set('businessAddress', e.target.value)} error={errors.businessAddress} />
                    <Field id="pickupAddress" label="Pickup Address *" icon={<Icon path={ICONS.truck} />} placeholder="Same as business or different address"
                      value={form.pickupAddress} onChange={(e) => set('pickupAddress', e.target.value)} error={errors.pickupAddress} />
                    <div className="grid sm:grid-cols-2 gap-x-5">
                      <Field id="city" label="City *" icon={<Icon path={ICONS.city} />} placeholder="Select city"
                        value={form.city} onChange={(e) => set('city', e.target.value)} error={errors.city} />
                      <Field id="province" label="Province / State *" icon={<Icon path={ICONS.map} />} placeholder="Select province"
                        value={form.province} onChange={(e) => set('province', e.target.value)} error={errors.province} />
                      <Field id="postalCode" label="Postal Code *" icon={<Icon path={ICONS.mailbox} />} placeholder="Enter postal code"
                        value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} error={errors.postalCode} />
                      <Field id="country" label="Country *" icon={<Icon path={ICONS.globe} />} placeholder="Select country"
                        value={form.country} onChange={(e) => set('country', e.target.value)} error={errors.country} />
                    </div>
                    <div className="max-w-[280px]">
                      <Field id="pickupTiming" type="time" label="Preferred Pickup Timing *" icon={<Icon path={ICONS.clock} />}
                        value={form.pickupTiming} onChange={(e) => set('pickupTiming', e.target.value)} error={errors.pickupTiming} />
                    </div>

                    <div className="mb-4">
                      <label className="text-[0.82rem] font-semibold text-ink block mb-1.5">Cash on Delivery Service Required</label>
                      <div className="flex items-center gap-3.5 border-[1.5px] border-line rounded-[10px] px-4 py-3.5">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={form.codRequired}
                          onClick={() => set('codRequired', !form.codRequired)}
                          className={`relative w-[46px] h-[26px] flex-none rounded-full transition-colors ${form.codRequired ? 'bg-success' : 'bg-[#D9DEE8]'}`}
                        >
                          <span className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow transition-transform ${form.codRequired ? 'translate-x-[23px]' : 'translate-x-[3px]'}`} />
                        </button>
                        <div>
                          <div className="font-bold text-sm text-ink">{form.codRequired ? 'Yes' : 'No'}</div>
                          <div className="text-xs text-muted">Turn on if you want us to collect cash from buyers and pay it out to you</div>
                        </div>
                      </div>
                    </div>

                    <fieldset className="mt-1 mb-1.5">
                      <legend className="text-sm font-bold text-ink mb-3 p-0">Bank Account Details</legend>
                      <div className="grid sm:grid-cols-2 gap-x-5">
                        <Field id="bankName" label="Bank Name *" icon={<Icon path={ICONS.bank} />} placeholder="e.g. HBL, Meezan, UBL"
                          value={form.bankName} onChange={(e) => set('bankName', e.target.value)} error={errors.bankName} />
                        <Field id="accountTitle" label="Account Title *" icon={<Icon path={ICONS.user} />} placeholder="Name on the account"
                          value={form.accountTitle} onChange={(e) => set('accountTitle', e.target.value)} error={errors.accountTitle} />
                      </div>
                      <Field id="accountNumber" label="Account Number / IBAN *" icon={<Icon path={ICONS.card} />} placeholder="PK00XXXX0000000000000000"
                        value={form.accountNumber} onChange={(e) => set('accountNumber', e.target.value)} error={errors.accountNumber} />
                    </fieldset>

                    <div className="flex gap-2.5 items-start mt-1.5 mb-1">
                      <input type="checkbox" id="acceptTerms" checked={form.acceptTerms} onChange={(e) => set('acceptTerms', e.target.checked)}
                        className="w-[18px] h-[18px] mt-0.5 accent-orange flex-none" />
                      <label htmlFor="acceptTerms" className="font-normal text-sm text-ink">
                        I accept the <a href="#" className="text-orange font-semibold no-underline">Terms &amp; Conditions</a> and{' '}
                        <a href="#" className="text-orange font-semibold no-underline">Privacy Policy</a>
                      </label>
                    </div>
                    {errors.acceptTerms && <p className="text-[0.74rem] text-danger mb-2.5">{errors.acceptTerms}</p>}
                  </>
                )}

                {step === 4 && (
                  <>
                    <p className="text-sm text-muted mb-5 leading-relaxed">
                      We&apos;ve sent a 6-digit verification code to <b className="text-ink">{maskEmail(form.sellerEmail)}</b>. Enter it below to confirm your account.
                    </p>

                    <div className="text-xs text-muted bg-[#FBF3EA] border border-dashed border-[#F0C89A] px-3 py-2.5 rounded-lg mb-5">
                      Demo mode — no real email is sent. Your one-time code is <b className="text-orange">{generatedOtp}</b>.
                    </div>

                    <OtpBoxes value={otpValue} onChange={setOtpValue} />
                    {otpError && <p className="text-[0.74rem] text-danger mb-3.5">{otpError}</p>}

                    <p className="text-sm text-muted mb-5">
                      Didn&apos;t get the code?{' '}
                      <button type="button" disabled={resendSeconds > 0} onClick={sendOtp}
                        className="text-orange font-bold bg-transparent p-0 disabled:text-muted disabled:cursor-not-allowed">
                        {resendSeconds > 0 ? `Resend code (${resendSeconds}s)` : 'Resend code'}
                      </button>
                    </p>
                  </>
                )}

                <div className="flex justify-between items-center mt-7">
                  <button type="button" onClick={goBack} disabled={step === 1}
                    className="text-muted hover:text-ink font-bold text-sm px-1.5 py-3 bg-transparent disabled:invisible">
                    ← Back
                  </button>
                  {step < 4 ? (
                    <button type="button" onClick={goNext}
                      className="bg-navy hover:bg-navy-light text-white font-bold text-sm px-6 py-3.5 rounded-[10px] transition-colors">
                      {step === 3 ? 'Verify email →' : 'Continue →'}
                    </button>
                  ) : (
                    <button type="submit"
                      className="bg-navy hover:bg-navy-light text-white font-bold text-sm px-6 py-3.5 rounded-[10px] transition-colors">
                      Verify &amp; Create Account ✓
                    </button>
                  )}
                </div>
              </form>

              <p className="text-center mt-6 text-sm text-muted">
                Already have an account?{' '}
                <Link href="/login" className="text-orange font-bold no-underline">Login</Link>
              </p>
            </>
          ) : (
            <div className="text-center py-8 px-2">
              <div className="w-[90px] h-[90px] rounded-full border-[3px] border-success flex items-center justify-center mx-auto mb-5 text-success text-4xl">✓</div>
              <h2 className="font-display text-xl font-bold mb-2">Account created</h2>
              <p className="text-muted max-w-[42ch] mx-auto">
                Your email is verified and your FastEx seller account is being reviewed. We&apos;ll notify you once it&apos;s active.
              </p>
              <div className="inline-block mt-4.5 px-4 py-2.5 bg-page border border-dashed border-line rounded-lg text-sm tracking-wide font-bold text-navy">
                REF: FX-{refNum}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
