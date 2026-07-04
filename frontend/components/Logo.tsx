export function Logo() {
  return (
    <div className="flex items-center gap-2.5 mb-10 md:mb-12">
      <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
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
        <div className="font-display text-2xl font-extrabold tracking-tight leading-none text-navy">
          FAST<span className="text-orange">EX</span>
        </div>
        <div className="text-[0.62rem] tracking-[0.22em] text-muted font-semibold mt-0.5">
          COURIER SERVICES
        </div>
      </div>
    </div>
  );
}
