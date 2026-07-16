// import { Logo } from './Logo';

// interface Perk {
//   title: string;
//   subtitle: string;
//   accent?: boolean;
// }

// const PERKS: Perk[] = [
//   { title: 'Fast Delivery', subtitle: 'Know exactly where every shipment is, always.' },
//   { title: '24/7 Support', subtitle: 'Reliable pickup and delivery across the country.', accent: true },
//   { title: 'Secure & insured', subtitle: 'Every package is handled with full accountability.' },
// ];

// export function BusinessHeroPanel({
//   heading,
//   highlight,
//   lede,
// }: {
//   heading: string;
//   highlight: string;
//   lede: string;
// }) {
//   return (
//     <div className="flex-1 lg:flex-[1.05] relative overflow-hidden px-7 md:px-14 pt-9 md:pt-13 min-h-[280px] lg:min-h-screen flex flex-col bg-hero-gradient text-navy">
//       <Logo />

//       <h1 className="font-display text-3xl md:text-4xl font-extrabold leading-tight mb-4 max-w-[480px]">
//         {heading}
//         <br />
//         <span className="text-orange">{highlight}</span>
//       </h1>
//       <p className="text-base text-[#3A4A64] max-w-[420px] leading-relaxed mb-10">{lede}</p>

//       <div className="flex flex-col gap-4 mb-auto">
//         {PERKS.map((perk) => (
//           <div key={perk.title} className="flex items-start gap-3">
//             <div
//               className={`w-9 h-9 rounded-full flex-none flex items-center justify-center text-white ${
//                 perk.accent ? 'bg-orange' : 'bg-navy'
//               }`}
//             >
//               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                 <path d="M20 6L9 17l-5-5" />
//               </svg>
//             </div>
//             <div>
//               <div className="font-bold text-sm">{perk.title}</div>
//               <div className="text-[0.82rem] text-muted">{perk.subtitle}</div>
//             </div>
//           </div>
//         ))}
//       </div>

//       <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2.5 py-5 md:py-6 border-t border-navy/10">
//         {[
//           ['50K+', 'Deliveries'],
//           ['120+', 'Cities'],
//           ['99.2%', 'On-time rate'],
//           ['24/7', 'Support'],
//         ].map(([num, label]) => (
//           <div key={label}>
//             <div className="text-orange font-extrabold text-lg font-display">{num}</div>
//             <div className="text-muted text-[0.7rem]">{label}</div>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

export default function BusinessHeroPanel() {
  return (
    <section
      className="
      relative
      flex
      flex-col
      justify-between
      overflow-hidden
      lg:w-1/2
      bg-gradient-to-br
      from-blue-100
      via-slate-100
      to-orange-100
      p-10
      lg:p-14
    "
    >
      {/* Logo */}

      <div>
        <div className="flex items-center gap-3 mb-12">

          <svg
            className="w-10 h-10"
            viewBox="0 0 40 40"
            fill="none"
          >
            <path
              d="M2 20L24 20L18 12L34 20L18 28L24 20"
              stroke="#F2701A"
              strokeWidth="3.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">
              FAST<span className="text-orange-500">EX</span>
            </h2>

            <p className="uppercase text-xs tracking-[4px] text-gray-500">
              Courier Services
            </p>
          </div>

        </div>

        {/* Heading */}

        <h1 className="text-5xl font-extrabold leading-tight text-slate-900 max-w-xl">

          Fast. Reliable.
          <br />

          <span className="text-orange-500">
            Delivered
          </span>{" "}
          with Care.

        </h1>

        <p className="mt-6 text-gray-600 text-lg max-w-md leading-8">
          Join FastEx and grow your business with our trusted courier
          solutions.
        </p>

        {/* Features */}

        <div className="space-y-6 mt-12">

          <Feature
            icon={
              <TruckIcon />
            }
            title="Fast Delivery"
            subtitle="On-time, every time"
            bg="bg-slate-900"
          />

          <Feature
            icon={<ShieldIcon />}
            title="Safe & Secure"
            subtitle="We care for your parcel"
            bg="bg-orange-500"
          />

          <Feature
            icon={<GlobeIcon />}
            title="Worldwide"
            subtitle="Delivering globally"
            bg="bg-slate-900"
          />

          <Feature
            icon={<SupportIcon />}
            title="24/7 Support"
            subtitle="We're here to help"
            bg="bg-orange-500"
          />

        </div>
      </div>

      {/* Illustration */}

      <div className="relative mt-16">

        <svg
          viewBox="0 0 600 230"
          className="w-full"
        >
          <path
            d="M0 210 C150 150,450 150,600 210 L600 230 L0 230 Z"
            fill="#0F2648"
            opacity=".06"
          />

          <path
            d="M0 214 C150 160,450 160,600 214"
            stroke="#F2701A"
            strokeWidth="4"
            fill="none"
          />

          <g opacity=".5">
            <rect x="20" y="120" width="18" height="90" fill="#173868" />
            <rect x="46" y="95" width="22" height="115" fill="#0F2648" />
            <rect x="76" y="130" width="16" height="80" fill="#173868" />

            <rect x="500" y="110" width="20" height="100" fill="#0F2648" />
            <rect x="528" y="140" width="16" height="70" fill="#173868" />
            <rect x="552" y="100" width="22" height="110" fill="#0F2648" />
          </g>
        </svg>

      </div>

      {/* Statistics */}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-t border-slate-300 pt-8">

        <Stat number="10K+" label="Parcels Delivered" />

        <Stat number="500+" label="Cities Covered" />

        <Stat number="5K+" label="Happy Customers" />

        <Stat number="24/7" label="Customer Support" />

      </div>

    </section>
  );
}

interface FeatureProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bg: string;
}

function Feature({
  icon,
  title,
  subtitle,
  bg,
}: FeatureProps) {
  return (
    <div className="flex items-center gap-4">

      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${bg}`}
      >
        {icon}
      </div>

      <div>
        <h3 className="font-semibold text-slate-900">
          {title}
        </h3>

        <p className="text-sm text-gray-500">
          {subtitle}
        </p>
      </div>

    </div>
  );
}

function Stat({
  number,
  label,
}: {
  number: string;
  label: string;
}) {
  return (
    <div>

      <h3 className="text-orange-500 text-2xl font-bold">
        {number}
      </h3>

      <p className="text-sm text-gray-500">
        {label}
      </p>

    </div>
  );
}

/* Icons */

function TruckIcon() {
  return (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <rect x="1" y="6" width="15" height="11" />
      <path d="M16 10h4l3 3v4h-7z" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18.5" cy="18" r="2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 2L4 5v6c0 5 3.5 9 8 11c4.5-2 8-6 8-11V5z" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 3.8 6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-6-3.8-9z" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 18v-6a9 9 0 0118 0v6" />
      <path d="M21 19a2 2 0 01-2 2h-1v-6h3z" />
      <path d="M3 19a2 2 0 002 2h1v-6H3z" />
    </svg>
  );
}