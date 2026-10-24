// The Meticulous mark (same geometry as public/logo.svg), drawn in the
// current text color so it follows the theme.
export const LogoMark = ({ className = "" }: { className?: string }) => (
  <svg
    viewBox="0 0 33 25"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M23.9809 0.046875V23.9536H0.0742188V0.046875L12.0276 12.0002L23.9809 0.046875Z" />
    <path d="M29.8956 24.2015C31.1799 24.2015 32.2277 23.1538 32.2277 21.8694C32.2277 20.5851 31.1799 19.5374 29.8956 19.5374C28.6112 19.5374 27.5635 20.5851 27.5635 21.8694C27.5635 23.1538 28.6112 24.2015 29.8956 24.2015Z" />
  </svg>
);
