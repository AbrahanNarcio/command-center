/** Pantalla de carga inicial: logo Content OS con anillo girando y etapa real. */
export default function SplashScreen({ stage }: { stage: string }) {
  return (
    <div className="loading-screen">
      <div className="splash">
        <div className="splash-ring">
          <span className="splash-arc" aria-hidden />
          <svg className="splash-logo" viewBox="0 0 64 64" role="img" aria-label="Content OS">
            <defs>
              <linearGradient id="splash-g" x1="0" y1="64" x2="64" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#feda75" />
                <stop offset="0.3" stopColor="#fa7e1e" />
                <stop offset="0.62" stopColor="#d62976" />
                <stop offset="1" stopColor="#962fbf" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="15" fill="url(#splash-g)" />
            <path
              d="M13 36h9l5-13 9 22 6-13h9"
              fill="none"
              stroke="#fff"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="splash-brand">Content OS</p>
        <p className="splash-stage" aria-live="polite">
          {stage}
        </p>
      </div>
    </div>
  );
}
