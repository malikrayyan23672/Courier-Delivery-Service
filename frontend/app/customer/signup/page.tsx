// Phone OTP customer registration. This is the canonical /customer/signup
// route from the TRD; the flow itself lives in /register (same phone +
// OTP verification against /auth/register, /auth/send-otp, /auth/verify-otp),
// re-exported here so both URLs resolve to one implementation.
export { default } from '../../register/page';
