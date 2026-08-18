export function Logo() {
  return (
    <a href="/">


    <div className="flex items-center gap-2.5 mb-10 md:mb-12">

      <img src="icon.jpeg" alt="" width={45} height={45} /> 
      <div>
        <div className="font-display text-2xl font-extrabold tracking-tight leading-none text-navy">
          RAFTAAR<span className="text-[#db2203]">EXPRESS</span>
        </div>
        <div className="text-[0.62rem] tracking-[0.22em] text-muted-foreground font-semibold mt-0.5">
          COURIER SERVICES
        </div>
      </div>
    </div>
    </a>
  );
}
