import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export function PageHeader({
  label,
  title,
  subtitle,
  action,
}: {
  label?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="bill-page-header">
      <div>
        {label ? <div className="ac-label">{label}</div> : null}
        <h1 className="bill-page-title">{title}</h1>
        {subtitle ? <p className="bill-page-sub">{subtitle}</p> : null}
      </div>
      {action ? <div className="bill-page-action">{action}</div> : null}
    </header>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="bill-stat-grid">{children}</div>;
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: string;
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={'bill-stat-card' + (accent ? ' bill-stat-card--accent' : '')}>
      <div className="bill-stat-icon">
        <i className={'fas ' + icon} />
      </div>
      <div className="bill-stat-label">{label}</div>
      <div className="bill-stat-value">{value}</div>
      {hint ? <div className="bill-stat-hint">{hint}</div> : null}
    </div>
  );
}

export function BillingCard({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={'bill-card ac-card ' + className} style={style}>
      {children}
    </div>
  );
}

export function BillingAlert({
  type,
  children,
}: {
  type: 'error' | 'success' | 'info';
  children: ReactNode;
}) {
  return <div className={'bill-alert bill-alert--' + type}>{children}</div>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: { to: string; label: string };
}) {
  return (
    <div className="bill-empty">
      <i className={'fas ' + icon} />
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? (
        <Link to={action.to} className="ac-btn ac-btn-primary">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function LoadingBlock({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="bill-loading">
      <i className="fas fa-circle-notch fa-spin" />
      <span>{label}</span>
    </div>
  );
}

export function TypeTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="bill-tabs">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          className={'bill-tab' + (value === o.id ? ' bill-tab--active' : '')}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
