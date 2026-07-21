import { ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function BillFormShell({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={'bill-form-shell ' + className}>
      <header className="bill-form-shell__head">
        <h2 className="bill-form-shell__title">{title}</h2>
        {subtitle ? <p className="bill-form-shell__sub">{subtitle}</p> : null}
      </header>
      <div className="bill-form-shell__body">{children}</div>
    </div>
  );
}

export function BillFormGrid({
  children,
  cols = 2,
}: {
  children: ReactNode;
  cols?: 1 | 2;
}) {
  return <div className={'bill-form-grid bill-form-grid--' + cols}>{children}</div>;
}

export function BillField({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="bill-field">
      <label className="bill-field__label">
        {label}
        {required ? <span className="bill-field__req">*</span> : null}
      </label>
      {children}
      {hint ? <p className="bill-field__hint">{hint}</p> : null}
    </div>
  );
}

type IconInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: string;
};

export function BillInput({ icon = 'fa-pen', className = '', ...props }: IconInputProps) {
  return (
    <div className="bill-input-wrap">
      {icon ? <i className={'bill-input-wrap__icon fas ' + icon} aria-hidden /> : null}
      <input className={'bill-input ' + className} {...props} />
    </div>
  );
}

type IconTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  icon?: string;
};

export function BillTextarea({ icon = 'fa-comment', className = '', rows = 5, ...props }: IconTextareaProps) {
  return (
    <div className="bill-input-wrap bill-input-wrap--area">
      {icon ? <i className={'bill-input-wrap__icon fas ' + icon} aria-hidden /> : null}
      <textarea className={'bill-input bill-input--area ' + className} rows={rows} {...props} />
    </div>
  );
}

type BillSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[];
};

export function BillSelect({ options, className = '', ...props }: BillSelectProps) {
  return (
    <div className="bill-select-wrap">
      <select className={'bill-select ' + className} {...props}>
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <i className="fas fa-chevron-down bill-select-wrap__chev" aria-hidden />
    </div>
  );
}

export function BillFormActions({
  children,
  attach,
}: {
  children: ReactNode;
  attach?: ReactNode;
}) {
  return (
    <div className="bill-form-actions">
      <div className="bill-form-actions__main">{children}</div>
      {attach ? <div className="bill-form-actions__attach">{attach}</div> : null}
    </div>
  );
}

export function BillAttachBtn({
  onClick,
  title = 'Прикрепить файл',
}: {
  onClick: () => void;
  title?: string;
}) {
  return (
    <button type="button" className="bill-attach-btn" onClick={onClick} title={title} aria-label={title}>
      <i className="fas fa-paperclip" aria-hidden />
    </button>
  );
}

export function BillChipGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="bill-chip-grid">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          className={'bill-chip' + (value === o.id ? ' bill-chip--active' : '')}
          style={value === o.id && o.color ? { borderColor: o.color, color: o.color } : undefined}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function BillPresetGrid({
  values,
  selected,
  onSelect,
  suffix = '₽',
}: {
  values: number[];
  selected: number;
  onSelect: (n: number) => void;
  suffix?: string;
}) {
  return (
    <div className="bill-preset-grid">
      {values.map(v => (
        <button
          key={v}
          type="button"
          className={'bill-preset' + (selected === v ? ' bill-preset--active' : '')}
          onClick={() => onSelect(v)}
        >
          {v}
          {suffix}
        </button>
      ))}
    </div>
  );
}

export function BillPayMethods({
  methods,
  value,
  onChange,
}: {
  methods: { id: string; label: string; icon: ReactNode }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="bill-pay-methods">
      {methods.map(m => (
        <button
          key={m.id}
          type="button"
          className={'bill-pay-method' + (value === m.id ? ' bill-pay-method--active' : '')}
          onClick={() => onChange(m.id)}
        >
          <span className="bill-pay-method__icon">{m.icon}</span>
          <span className="bill-pay-method__label">{m.label}</span>
        </button>
      ))}
    </div>
  );
}
