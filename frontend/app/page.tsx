'use client';

import { useEffect } from 'react';
import { useState, useRef, FormEvent } from "react";
 
import { useRouter } from 'next/navigation';
import { useAuth, panelPathForRole } from '@/context/AuthContext';

type ModalMode = "login" | "forgot" | "success";
export default function HomePage() {
  const { token, role, isLoading } = useAuth();
  const router = useRouter();

   // ---- login modal state ----
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<ModalMode>("login");
 
  // ---- login form state ----
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmailError, setLoginEmailError] = useState(false);
  const [loginPasswordError, setLoginPasswordError] = useState(false);
 
  // ---- forgot password state ----
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailError, setForgotEmailError] = useState(false);
  const [fpSent, setFpSent] = useState(false);
 
  // ---- track shipment state ----
  const [trackingId, setTrackingId] = useState("");
  const [trackInvalid, setTrackInvalid] = useState(false);
  const [trackResultActive, setTrackResultActive] = useState(false);
  const [trResultId, setTrResultId] = useState("FX-482913");
 
  const loginEmailRef = useRef<HTMLInputElement>(null);
  const loginPasswordRef = useRef<HTMLInputElement>(null);
  const forgotEmailRef = useRef<HTMLInputElement>(null);
 
  function openModal() {
    setMode("login");
    setModalOpen(true);
    document.body.style.overflow = "hidden";
  }
 
  function closeModal() {
    setModalOpen(false);
    document.body.style.overflow = "";
  }
 
  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) closeModal();
  }
 
  function goToForgot(e: React.MouseEvent) {
    e.preventDefault();
    setFpSent(false);
    setMode("forgot");
  }
 
  function backToLogin() {
    setMode("login");
  }
 
  function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    const emailOk = !!loginEmailRef.current?.checkValidity();
    const passwordOk = !!loginPasswordRef.current?.checkValidity();
    setLoginEmailError(!emailOk);
    setLoginPasswordError(!passwordOk);
    if (!emailOk || !passwordOk) return;
    setMode("success");
  }
 
  function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = !!forgotEmailRef.current?.checkValidity();
    setForgotEmailError(!ok);
    if (!ok) return;
    setFpSent(true);
  }
 
  function runTrack() {
    const val = trackingId.trim();
    const ok = val.length > 0;
    setTrackInvalid(!ok);
    if (!ok) {
      setTrackResultActive(false);
      return;
    }
    setTrResultId(val.toUpperCase().startsWith("FX") ? val.toUpperCase() : "FX-" + val);
    setTrackResultActive(true);
  }
 
  function handleTrackKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") runTrack();
  }
 
  function handleTrackInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTrackingId(e.target.value);
    setTrackInvalid(false);
  }

  useEffect(() => {
    if (isLoading) return;
    // router.push(token ? panelPathForRole(role) : '/login');
    router.push(token? panelPathForRole(role) : "/")
  }, [isLoading, token, role, router]);

  // return null;
  return (
    <>
      {/* ============ TOP NAV ============ */}
      <nav className="nav">
        <a href="#" className="logo">
          <svg className="logo-mark" viewBox="0 0 40 40" fill="none">
            <path
              d="M2 20 L24 20 L18 12 L34 20 L18 28 L24 20"
              fill="none"
              stroke="#F2701A"
              strokeWidth="3.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <div className="brand-name">
              FAST<span className="fx">EX</span>
            </div>
            <div className="brand-sub">COURIER SERVICES</div>
          </div>
        </a>

        <div className='flex gap-2 items-center'>

          <a href="/login" className='btn-login-nav'>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <path d="M10 17l5-5-5-5M15 12H3" />
            </svg>
          Login</a>

          <a href="/register" className='btn-register-nav'>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <path d="M10 17l5-5-5-5M15 12H3" />
            </svg>
          Register</a>
 
        {/* <button type="button" className="btn-login-nav" onClick={openModal}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <path d="M10 17l5-5-5-5M15 12H3" />
          </svg>
          Login
        </button>

        <button type="button" className="btn-register-nav" onClick={openModal}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <path d="M10 17l5-5-5-5M15 12H3" />
          </svg>
          Register
        </button> */}
        </div>
      </nav>
 
      {/* ============ HERO / TRACK ============ */}
      <section className="hero">
        <div className="hero-eyebrow">TRUSTED BY 5,000+ BUSINESSES ACROSS PAKISTAN</div>
        <h1>
          Fast. Reliable. <span className="hl-orange">Delivered</span> with Care.
        </h1>
        <p className="lede">
          FastEx is Pakistan&apos;s growing courier network — track any shipment instantly below, no account required.
        </p>
 
        <div className="track-card">
          <div className="track-card-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
            Track your shipment
          </div>
          <div className="track-row">
            <div className="input-wrap">
              <svg className="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7V5a2 2 0 0 1 2-2h2M3 17v2a2 2 0 0 0 2 2h2M21 7V5a2 2 0 0 0-2-2h-2M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 12h10" />
              </svg>
              <input
                type="text"
                id="trackingId"
                placeholder="Enter tracking ID, e.g. FX-482913"
                autoComplete="off"
                className={trackInvalid ? "invalid" : ""}
                value={trackingId}
                onChange={handleTrackInputChange}
                onKeyDown={handleTrackKeyDown}
              />
            </div>
            <button type="button" className="btn-track" onClick={runTrack}>
              Track
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <div className={`track-err${trackInvalid ? " active" : ""}`}>Enter a tracking ID to continue.</div>
 
          <div className={`track-result${trackResultActive ? " active" : ""}`}>
            <div className="tr-head">
              <span className="tr-id">{trResultId}</span>
              <span className="tr-badge">In Transit</span>
            </div>
            <div className="tr-eta">
              Estimated delivery: <b>Tomorrow, by 6:00 PM</b>
            </div>
            <div className="tr-steps">
              <div className="tr-step">
                <div className="tr-dot">✓</div>
                <div className="tr-step-label">Picked up</div>
              </div>
              <div className="tr-step">
                <div className="tr-dot">✓</div>
                <div className="tr-step-label">In transit</div>
              </div>
              <div className="tr-step pending">
                <div className="tr-dot">3</div>
                <div className="tr-step-label">Out for delivery</div>
              </div>
              <div className="tr-step pending">
                <div className="tr-dot">4</div>
                <div className="tr-step-label">Delivered</div>
              </div>
            </div>
          </div>
        </div>
 
        <div className="hero-stats">
          <div className="hstat">
            <div className="num">10K+</div>
            <div className="lbl">Parcels Delivered</div>
          </div>
          <div className="hstat">
            <div className="num">500+</div>
            <div className="lbl">Cities Covered</div>
          </div>
          <div className="hstat">
            <div className="num">5K+</div>
            <div className="lbl">Happy Customers</div>
          </div>
          <div className="hstat">
            <div className="num">24/7</div>
            <div className="lbl">Customer Support</div>
          </div>
        </div>
      </section>
 
      {/* ============ FEATURES ============ */}
      <section className="section">
        <div className="section-head">
          <div className="eyebrow">WHY FASTEX</div>
          <h2>Built for reliable, everyday delivery</h2>
          <p>
            Whether you&apos;re sending a single parcel or running a growing online store, FastEx keeps every shipment moving
            and visible.
          </p>
        </div>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="f-icon navy-bg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="6" width="15" height="11" />
                <path d="M16 10h4l3 3v4h-7z" />
                <circle cx="6" cy="18" r="2" />
                <circle cx="18.5" cy="18" r="2" />
              </svg>
            </div>
            <h3>Fast Delivery</h3>
            <p>Same-city delivery in as little as 24 hours, with nationwide coverage on every route.</p>
          </div>
          <div className="feature-card">
            <div className="f-icon orange-bg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />
              </svg>
            </div>
            <h3>Safe &amp; Secure</h3>
            <p>Every parcel is scanned at each handoff, so it&apos;s accounted for from pickup to doorstep.</p>
          </div>
          <div className="feature-card">
            <div className="f-icon navy-bg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.6 3.8 6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-6-3.8-9s1.3-6.4 3.8-9z" />
              </svg>
            </div>
            <h3>500+ Cities</h3>
            <p>From major metros to smaller towns, our network reaches customers across the country.</p>
          </div>
          <div className="feature-card">
            <div className="f-icon orange-bg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3z" />
                <path d="M3 19a2 2 0 0 0 2 2h1v-6H3z" />
              </svg>
            </div>
            <h3>24/7 Support</h3>
            <p>Real people, always reachable, whenever you have a question about a shipment.</p>
          </div>
        </div>
      </section>
 
      {/* ============ ABOUT ============ */}
      <section className="about-band">
        <div className="section about-grid">
          <div>
            <h2>About FastEx Courier Services</h2>
            <p>
              FastEx started with a simple goal: make shipping in Pakistan fast, transparent, and stress-free — for
              individual senders and growing online sellers alike.
            </p>
            <p>
              Today we move thousands of parcels every day across our nationwide network, backed by real-time tracking
              and a support team that&apos;s always reachable.
            </p>
            <ul className="about-list">
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Cash on delivery collection and payout for sellers
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Door-to-door pickup, no drop-off required
              </li>
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                Live tracking from pickup to final delivery
              </li>
            </ul>
          </div>
          <div className="about-visual">
            <div className="about-stat-card">
              <span className="lbl">Founded</span>
              <span className="num">2019</span>
            </div>
            <div className="about-stat-card">
              <span className="lbl">Cities covered</span>
              <span className="num">500+</span>
            </div>
            <div className="about-stat-card">
              <span className="lbl">Parcels delivered</span>
              <span className="num">10K+ daily</span>
            </div>
          </div>
        </div>
      </section>
 
      <footer>
        © 2026 <span className="fx">FastEx</span> Courier Services. All rights reserved.
      </footer>
 
      {/* ============ LOGIN MODAL ============ */}
      <div className={`modal-overlay${modalOpen ? " active" : ""}`} onClick={handleOverlayClick}>
        <div className="modal-card">
          <button type="button" className="modal-close" aria-label="Close" onClick={closeModal}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
 
          {/* LOGIN */}
          <div className={`mode-panel${mode === "login" ? " active" : ""}`}>
            <div className="card-head">
              <div className="head-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div>
                <h2>
                  Welcome <span className="hl">Back</span>
                </h2>
                <p>Login to your FastEx account</p>
              </div>
            </div>
 
            <form onSubmit={handleLoginSubmit} noValidate>
              <div className={`field${loginEmailError ? " has-error" : ""}`}>
                <label htmlFor="loginEmail">Email Address</label>
                <div className="input-wrap">
                  <svg className="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m2 6 10 7 10-7" />
                  </svg>
                  <input
                    type="email"
                    id="loginEmail"
                    ref={loginEmailRef}
                    placeholder="Enter your email"
                    required
                    className={loginEmailError ? "invalid" : ""}
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      setLoginEmailError(false);
                    }}
                  />
                </div>
                <span className="err-msg">Enter a valid email address.</span>
              </div>
 
              <div className={`field${loginPasswordError ? " has-error" : ""}`}>
                <label htmlFor="loginPassword">Password</label>
                <div className="input-wrap">
                  <svg className="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="10" width="16" height="10" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="loginPassword"
                    ref={loginPasswordRef}
                    placeholder="Enter your password"
                    required
                    className={loginPasswordError ? "invalid" : ""}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setLoginPasswordError(false);
                    }}
                  />
                  <button
                    type="button"
                    className="toggle-eye"
                    aria-label="Show password"
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
                <span className="err-msg">Enter your password.</span>
              </div>
 
              <div className="row-between">
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />{" "}
                  Remember me
                </label>
                <a href="#" onClick={goToForgot}>
                  Forgot password?
                </a>
              </div>
 
              <button type="submit" className="btn-primary">
                Login{" "}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </form>
 
            <div className="signup-link">
              Don&apos;t have an account? <a href="/signup">Sign Up</a>
            </div>
          </div>
 
          {/* FORGOT PASSWORD */}
          <div className={`mode-panel${mode === "forgot" ? " active" : ""}`}>
            <div className="card-head">
              <div className="head-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
              </div>
              <div>
                <h2>
                  Reset <span className="hl">Password</span>
                </h2>
                <p>We&apos;ll email you a reset link</p>
              </div>
            </div>
 
            <p className="fp-copy">
              Enter the email linked to your account. If it matches, we&apos;ll send a link to create a new password.
            </p>
            <div className={`fp-sent${fpSent ? " active" : ""}`}>Reset link sent — please check your inbox.</div>
 
            <form onSubmit={handleForgotSubmit} noValidate>
              <div className={`field${forgotEmailError ? " has-error" : ""}`}>
                <label htmlFor="forgotEmail">Email Address</label>
                <div className="input-wrap">
                  <svg className="icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="m2 6 10 7 10-7" />
                  </svg>
                  <input
                    type="email"
                    id="forgotEmail"
                    ref={forgotEmailRef}
                    placeholder="Enter your email"
                    required
                    className={forgotEmailError ? "invalid" : ""}
                    value={forgotEmail}
                    onChange={(e) => {
                      setForgotEmail(e.target.value);
                      setForgotEmailError(false);
                    }}
                  />
                </div>
                <span className="err-msg">Enter a valid email address.</span>
              </div>
              <button type="submit" className="btn-primary">
                Send reset link
              </button>
            </form>
 
            <button type="button" className="fp-back" onClick={backToLogin}>
              ← Back to login
            </button>
          </div>
 
          {/* SUCCESS */}
          <div className={`mode-panel${mode === "success" ? " active" : ""}`}>
            <div className="seal">
              <div className="seal-ring">✓</div>
              <h2>You&apos;re logged in</h2>
              <p>Redirecting you to your FastEx account…</p>
            </div>
          </div>
        </div>
      </div>
 
      <style jsx global>{`
        :root {
          --navy: #0f2648;
          --navy-2: #173868;
          --orange: #f2701a;
          --orange-2: #ff8a3d;
          --text-dark: #16233d;
          --text-gray: #6b7686;
          --border: #e4e8f0;
          --bg-page: #f3f5f9;
          --success: #1e8e5a;
          --danger: #d8432c;
        }
        * {
          box-sizing: border-box;
        }
        html,
        body {
          margin: 0;
          padding: 0;
        }
        body {
          font-family: "Inter", sans-serif;
          color: var(--text-dark);
          background: var(--bg-page);
          -webkit-font-smoothing: antialiased;
        }
        h1,
        h2,
        h3,
        .brand-name {
          font-family: "Poppins", sans-serif;
        }
        a {
          color: inherit;
        }
        ::selection {
          background: var(--orange-2);
          color: #fff;
        }
        :focus-visible {
          outline: 2px solid var(--orange);
          outline-offset: 2px;
        }
 
        /* ============ TOP NAV ============ */
        .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 48px;
          background: #fff;
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        @media (max-width: 640px) {
          .nav {
            padding: 16px 20px;
          }
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }
        .logo-mark {
          width: 32px;
          height: 32px;
          flex: 0 0 auto;
        }
        .brand-name {
          font-size: 1.3rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          line-height: 1;
          color: var(--navy);
        }
        .brand-name .fx {
          color: var(--orange);
        }
        .brand-sub {
          font-size: 0.6rem;
          letter-spacing: 0.2em;
          color: var(--text-gray);
          font-weight: 600;
          margin-top: 2px;
        }

        .btn-register-nav {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--orange);
          color: #fff;
          font-family: "Inter", sans-serif;
          font-weight: 700;
          font-size: 0.88rem;
          border: none;
          border-radius: 10px;
          padding: 11px 22px;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .btn-register-nav:hover {
          background: var(--navy-2);
        }
        .btn-register-nav:active {
          transform: scale(0.97);
        }
        .btn-register-nav svg {
          width: 16px;
          height: 16px;
        }
 
        .btn-login-nav {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--navy);
          color: #fff;
          font-family: "Inter", sans-serif;
          font-weight: 700;
          font-size: 0.88rem;
          border: none;
          border-radius: 10px;
          padding: 11px 22px;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .btn-login-nav:hover {
          background: var(--navy-2);
        }
        .btn-login-nav:active {
          transform: scale(0.97);
        }
        .btn-login-nav svg {
          width: 16px;
          height: 16px;
        }
 
        /* ============ HERO / TRACK SECTION ============ */
        .hero {
          background: linear-gradient(150deg, #dcebff 0%, #eaf1fc 35%, #fce3c6 78%, #fbd5a6 100%);
          padding: 64px 24px 70px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .hero-eyebrow {
          font-size: 0.72rem;
          letter-spacing: 0.18em;
          font-weight: 700;
          color: var(--navy-2);
          background: rgba(255, 255, 255, 0.55);
          border: 1px solid rgba(15, 38, 72, 0.12);
          padding: 6px 14px;
          border-radius: 20px;
          margin-bottom: 20px;
        }
        .hero h1 {
          font-size: 2.5rem;
          font-weight: 800;
          line-height: 1.15;
          margin: 0 0 14px;
          color: var(--navy);
          max-width: 640px;
        }
        .hero h1 .hl-orange {
          color: var(--orange);
        }
        .hero p.lede {
          font-size: 1.02rem;
          color: #3a4a64;
          max-width: 520px;
          line-height: 1.6;
          margin: 0 0 36px;
        }
 
        .track-card {
          background: #fff;
          border-radius: 18px;
          box-shadow: 0 24px 60px -18px rgba(15, 38, 72, 0.28);
          padding: 26px 26px 22px;
          width: 100%;
          max-width: 560px;
        }
        @media (max-width: 520px) {
          .track-card {
            padding: 20px 18px;
          }
        }
        .track-card-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--navy);
          margin-bottom: 12px;
        }
        .track-card-label svg {
          width: 18px;
          height: 18px;
          color: var(--orange);
        }
 
        .track-row {
          display: flex;
          gap: 10px;
        }
        @media (max-width: 480px) {
          .track-row {
            flex-direction: column;
          }
        }
        .input-wrap {
          position: relative;
          flex: 1;
        }
        .input-wrap svg.icn {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          color: var(--text-gray);
          pointer-events: none;
        }
        input[type="text"],
        input[type="email"],
        input[type="password"] {
          width: 100%;
          font-family: "Inter", sans-serif;
          font-size: 0.95rem;
          padding: 14px 14px 14px 42px;
          border: 1.5px solid var(--border);
          border-radius: 10px;
          background: #fbfcfe;
          color: var(--text-dark);
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }
        input:focus {
          border-color: var(--orange);
          background: #fff;
          box-shadow: 0 0 0 3px rgba(242, 112, 26, 0.13);
        }
        input.invalid {
          border-color: var(--danger);
          box-shadow: 0 0 0 3px rgba(216, 67, 44, 0.12);
        }
        input::placeholder {
          color: #5b6472;
          opacity: 1;
        }
 
        .btn-track {
          background: var(--orange);
          color: #fff;
          font-family: "Inter", sans-serif;
          font-weight: 700;
          font-size: 0.92rem;
          border: none;
          border-radius: 10px;
          padding: 14px 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
          white-space: nowrap;
        }
        .btn-track:hover {
          background: #e4630f;
        }
        .btn-track:active {
          transform: scale(0.98);
        }
        .btn-track svg {
          width: 16px;
          height: 16px;
        }
 
        .track-err {
          font-size: 0.78rem;
          color: var(--danger);
          text-align: left;
          margin-top: 8px;
          display: none;
        }
        .track-err.active {
          display: block;
        }
 
        .track-result {
          display: none;
          margin-top: 20px;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          padding: 18px 18px 8px;
          text-align: left;
        }
        .track-result.active {
          display: block;
        }
        .tr-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
          flex-wrap: wrap;
          gap: 8px;
        }
        .tr-id {
          font-weight: 800;
          color: var(--navy);
          font-size: 0.95rem;
        }
        .tr-badge {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--success);
          background: #e9f7ef;
          padding: 4px 10px;
          border-radius: 20px;
        }
        .tr-eta {
          font-size: 0.78rem;
          color: var(--text-gray);
          margin-bottom: 18px;
        }
        .tr-steps {
          display: flex;
          justify-content: space-between;
          position: relative;
          margin: 0 4px;
        }
        .tr-steps::before {
          content: "";
          position: absolute;
          top: 11px;
          left: 11px;
          right: 11px;
          height: 2px;
          background: var(--border);
          z-index: 0;
        }
        .tr-steps::after {
          content: "";
          position: absolute;
          top: 11px;
          left: 11px;
          width: 64%;
          height: 2px;
          background: var(--orange);
          z-index: 0;
        }
        .tr-step {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex: 1;
        }
        .tr-dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--orange);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          border: 3px solid #fff;
          box-shadow: 0 0 0 1px var(--orange);
        }
        .tr-step.pending .tr-dot {
          background: #fff;
          color: var(--text-gray);
          box-shadow: 0 0 0 1px var(--border);
        }
        .tr-step-label {
          font-size: 0.66rem;
          color: var(--text-gray);
          text-align: center;
          max-width: 60px;
        }
 
        .hero-stats {
          display: flex;
          gap: 36px;
          margin-top: 40px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .hstat {
          text-align: center;
        }
        .hstat .num {
          color: var(--orange);
          font-weight: 800;
          font-size: 1.4rem;
          font-family: "Poppins", sans-serif;
        }
        .hstat .lbl {
          color: var(--text-gray);
          font-size: 0.76rem;
          margin-top: 2px;
        }
 
        /* ============ ABOUT / FEATURES ============ */
        .section {
          padding: 70px 48px;
          max-width: 1120px;
          margin: 0 auto;
        }
        @media (max-width: 640px) {
          .section {
            padding: 50px 20px;
          }
        }
        .section-head {
          text-align: center;
          max-width: 560px;
          margin: 0 auto 44px;
        }
        .section-head .eyebrow {
          font-size: 0.72rem;
          letter-spacing: 0.18em;
          font-weight: 700;
          color: var(--orange);
          margin-bottom: 10px;
        }
        .section-head h2 {
          font-size: 1.8rem;
          font-weight: 800;
          color: var(--navy);
          margin: 0 0 12px;
        }
        .section-head p {
          color: var(--text-gray);
          font-size: 0.96rem;
          line-height: 1.6;
          margin: 0;
        }
 
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 22px;
        }
        @media (max-width: 900px) {
          .feature-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 520px) {
          .feature-grid {
            grid-template-columns: 1fr;
          }
        }
        .feature-card {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 24px 20px;
        }
        .f-icon {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          margin-bottom: 16px;
        }
        .f-icon.navy-bg {
          background: var(--navy);
        }
        .f-icon.orange-bg {
          background: var(--orange);
        }
        .feature-card h3 {
          font-size: 1rem;
          margin: 0 0 6px;
          color: var(--navy);
        }
        .feature-card p {
          font-size: 0.85rem;
          color: var(--text-gray);
          line-height: 1.55;
          margin: 0;
        }
 
        .about-band {
          background: #fff;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .about-grid {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: 48px;
          align-items: center;
        }
        @media (max-width: 820px) {
          .about-grid {
            grid-template-columns: 1fr;
          }
        }
        .about-grid h2 {
          font-size: 1.7rem;
          font-weight: 800;
          color: var(--navy);
          margin: 0 0 14px;
        }
        .about-grid p {
          color: var(--text-gray);
          font-size: 0.95rem;
          line-height: 1.7;
          margin: 0 0 14px;
        }
        .about-list {
          list-style: none;
          margin: 20px 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .about-list li {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          font-size: 0.9rem;
          color: var(--text-dark);
        }
        .about-list svg {
          width: 18px;
          height: 18px;
          color: var(--success);
          flex: 0 0 auto;
          margin-top: 1px;
        }
        .about-visual {
          background: linear-gradient(150deg, #dcebff 0%, #fce3c6 100%);
          border-radius: 18px;
          padding: 30px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .about-stat-card {
          background: #fff;
          border-radius: 12px;
          padding: 16px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 8px 22px -10px rgba(15, 38, 72, 0.2);
        }
        .about-stat-card .num {
          font-family: "Poppins", sans-serif;
          font-weight: 800;
          color: var(--orange);
          font-size: 1.3rem;
        }
        .about-stat-card .lbl {
          color: var(--text-gray);
          font-size: 0.78rem;
        }
 
        footer {
          text-align: center;
          padding: 28px 20px;
          color: var(--text-gray);
          font-size: 0.8rem;
          border-top: 1px solid var(--border);
          background: #fff;
        }
        footer .fx {
          color: var(--orange);
          font-weight: 700;
        }
 
        /* ============ LOGIN MODAL ============ */
        .modal-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 36, 0.5);
          z-index: 100;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .modal-overlay.active {
          display: flex;
        }
        .modal-card {
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 30px 70px -20px rgba(15, 38, 72, 0.4);
          padding: 32px 34px 30px;
          width: 100%;
          max-width: 420px;
          position: relative;
          animation: modalIn 0.2s ease;
        }
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @media (max-width: 480px) {
          .modal-card {
            padding: 26px 20px;
          }
        }
        .modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-gray);
          padding: 6px;
          border-radius: 8px;
          display: flex;
        }
        .modal-close:hover {
          background: var(--bg-page);
          color: var(--text-dark);
        }
        .modal-close svg {
          width: 18px;
          height: 18px;
        }
 
        .card-head {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 22px;
        }
        .head-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--navy);
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          color: #fff;
        }
        .card-head h2 {
          font-size: 1.3rem;
          margin: 0;
          font-weight: 700;
        }
        .card-head h2 .hl {
          color: var(--orange);
        }
        .card-head p {
          margin: 4px 0 0;
          color: var(--text-gray);
          font-size: 0.86rem;
        }
 
        .mode-panel {
          display: none;
          animation: fadein 0.2s ease;
        }
        .mode-panel.active {
          display: block;
        }
        @keyframes fadein {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
 
        .field {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        label {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-dark);
        }
        .err-msg {
          font-size: 0.74rem;
          color: var(--danger);
          display: none;
        }
        .field.has-error .err-msg {
          display: block;
        }
 
        .toggle-eye {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: var(--text-gray);
        }
        .toggle-eye svg {
          width: 18px;
          height: 18px;
        }
 
        .row-between {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 2px 0 20px;
          font-size: 0.85rem;
        }
        .remember {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text-dark);
        }
        .remember input {
          width: 16px;
          height: 16px;
          accent-color: var(--orange);
        }
        .row-between a {
          color: var(--orange);
          font-weight: 600;
          text-decoration: none;
        }
        .row-between a:hover {
          text-decoration: underline;
        }
 
        button {
          font-family: "Inter", sans-serif;
        }
        .btn-primary {
          width: 100%;
          background: var(--navy);
          color: #fff;
          padding: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-weight: 700;
          font-size: 0.9rem;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;
        }
        .btn-primary:hover {
          background: var(--navy-2);
        }
        .btn-primary:active {
          transform: scale(0.98);
        }
 
        .signup-link {
          text-align: center;
          margin-top: 20px;
          font-size: 0.86rem;
          color: var(--text-gray);
        }
        .signup-link a {
          color: var(--orange);
          font-weight: 700;
          text-decoration: none;
        }
 
        .fp-copy {
          font-size: 0.85rem;
          color: var(--text-gray);
          line-height: 1.6;
          margin: 0 0 18px;
        }
        .fp-back {
          background: none;
          color: var(--orange);
          font-weight: 700;
          padding: 0;
          font-size: 0.85rem;
          margin-top: 14px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: none;
          cursor: pointer;
        }
        .fp-sent {
          display: none;
          background: #f2faf6;
          border: 1px solid #cdebdc;
          color: var(--success);
          font-size: 0.82rem;
          padding: 10px 12px;
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .fp-sent.active {
          display: block;
        }
 
        .seal {
          text-align: center;
          padding: 14px 4px 4px;
        }
        .seal-ring {
          width: 78px;
          height: 78px;
          border-radius: 50%;
          border: 3px solid var(--success);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 18px;
          color: var(--success);
          font-size: 2rem;
        }
        .seal h2 {
          font-size: 1.2rem;
          margin-bottom: 8px;
        }
        .seal p {
          color: var(--text-gray);
          max-width: 34ch;
          margin: 0 auto;
          font-size: 0.9rem;
        }
      `}</style>
    </>
  )
}
