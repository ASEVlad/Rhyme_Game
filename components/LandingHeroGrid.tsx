type Props = {
  targets?: readonly string[];
};

const DEFAULT_TARGETS = ['moon', 'soon', 'spree', 'free'] as const;

const ROW_OPACITY = [0.4, 1.0, 0.55, 0.25] as const;

const TARGET_COLORS = [
  '#ffd447', // yellow
  '#3aa3ff', // blue
  '#ff8a3c', // orange
  '#e44d4d', // red
] as const;

export function LandingHeroGrid({ targets = DEFAULT_TARGETS }: Props) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {targets.map((word, rowIdx) => {
        const isActive = rowIdx === 1;
        return (
          <div
            key={rowIdx}
            data-row={rowIdx}
            className="grid grid-cols-[1fr_1fr_1fr_1.6fr] md:grid-cols-[1fr_1fr_1fr_2fr] gap-2"
            style={{ opacity: ROW_OPACITY[rowIdx] }}
          >
            {[0, 1, 2].map(colIdx => (
              <div
                key={colIdx}
                data-cell="empty"
                data-col={colIdx}
                className="relative h-12 md:h-14 rounded-xl md:rounded-2xl bg-[rgba(94,200,255,0.06)]"
              >
                {isActive && colIdx === 2 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      data-ball
                      className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-[#ff9d2a]"
                      style={{ boxShadow: '0 0 12px rgba(255,157,42,0.8)' }}
                    />
                  </div>
                )}
              </div>
            ))}
            <div
              data-cell="target"
              data-col={3}
              className="h-12 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center font-bold text-sm md:text-base text-[#060c14]"
              style={{ background: TARGET_COLORS[rowIdx] }}
            >
              {word}
            </div>
          </div>
        );
      })}
    </div>
  );
}
