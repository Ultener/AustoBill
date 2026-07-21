import { Link } from 'react-router-dom';

const APP_NAME = 'AustoCloud';

type LogoProps = {
  to?: string;
  size?: number;
  showText?: boolean;
  className?: string;
};

export default function Logo({ to = '/', size = 36, showText = true, className = '' }: LogoProps) {
  const img = (
    <img
      src="/assets/logo.png"
      alt={APP_NAME}
      width={size}
      height={size}
      style={{ borderRadius: 10, objectFit: 'cover' }}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );

  const content = (
    <span className={`logo-wrap ${className}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {img}
      {showText && (
        <span style={{ fontSize: size * 0.5, fontWeight: 800, color: 'var(--text-white)', letterSpacing: '-0.03em' }}>
          {APP_NAME}
        </span>
      )}
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="logo" style={{ textDecoration: 'none' }}>
        {content}
      </Link>
    );
  }
  return content;
}

export { APP_NAME };
