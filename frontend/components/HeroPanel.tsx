import { Logo } from './Logo';

interface Perk {
  title: string;
  subtitle: string;
  accent?: boolean;
}

const PERKS: Perk[] = [
  { title: 'Real-time tracking', subtitle: 'Know exactly where every shipment is, always.' },
  { title: 'Fast nationwide delivery', subtitle: 'Reliable pickup and delivery across the country.', accent: true },
  { title: 'Secure & insured', subtitle: 'Every package is handled with full accountability.' },
];

export function HeroPanel({
  heading,
  highlight,
  lede,
}: {
  heading: string;
  highlight: string;
  lede: string;
}) {
  return (
    <div className="flex-1 lg:flex-[1.05] relative overflow-hidden px-7 md:px-14 pt-9 md:pt-13 min-h-[280px] lg:min-h-screen flex flex-col bg-hero-gradient text-navy">
      <Logo />

      <h1 className="font-display text-3xl md:text-4xl font-extrabold leading-tight mb-4 max-w-[480px]">
        {heading}
        <br />
        <span className="text-orange">{highlight}</span>
      </h1>
      <p className="text-base text-[#3A4A64] max-w-[420px] leading-relaxed mb-10">{lede}</p>

      <div className="flex flex-col gap-4 mb-auto">
        {PERKS.map((perk) => (
          <div key={perk.title} className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-full flex-none flex items-center justify-center text-white ${
                perk.accent ? 'bg-orange' : 'bg-navy'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-sm">{perk.title}</div>
              <div className="text-[0.82rem] text-muted">{perk.subtitle}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2.5 py-5 md:py-6 border-t border-navy/10">
        {[
          ['50K+', 'Deliveries'],
          ['120+', 'Cities'],
          ['99.2%', 'On-time rate'],
          ['24/7', 'Support'],
        ].map(([num, label]) => (
          <div key={label}>
            <div className="text-orange font-extrabold text-lg font-display">{num}</div>
            <div className="text-muted text-[0.7rem]">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
