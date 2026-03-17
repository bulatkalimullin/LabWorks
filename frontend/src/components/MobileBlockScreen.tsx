export default function MobileBlockScreen() {
  return (
    <div className="mobile-block-screen" aria-hidden="false">
      <div className="mobile-block-screen-inner">
        <div className="mobile-block-screen-icon" aria-hidden>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <h1 className="mobile-block-screen-title">Использование запрещено</h1>
        <p className="mobile-block-screen-text">
          На данном устройстве пользоваться сайтом запрещено. Откройте сайт на планшете или компьютере.
        </p>
      </div>
    </div>
  )
}
