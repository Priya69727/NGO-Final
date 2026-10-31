import { useId } from 'react';

interface Base { hideLabel?: boolean; label: string; value: string; onChange: (v: string) => void; required?: boolean; wide?: boolean; placeholder?: string; disabled?: boolean; step?: string | number }

export function TextField({ label, value, onChange, required, wide, type = 'text', placeholder, disabled, step }: Base & { type?: string }) {
  const id = useId();
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="form-label" htmlFor={id}>{label}{required && ' *'}</label>
      <input id={id} className="form-input" type={type} step={step} required={required} placeholder={placeholder} disabled={disabled} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

type SelectOption = string | { label: string; value: string };

export function SelectField({ label, value, onChange, options, required, wide, hideLabel, disabled }: Base & { options: SelectOption[] }) {
  const id = useId();
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className={hideLabel ? 'sr-only' : 'form-label'} htmlFor={id}>{label}{required && ' *'}</label>
      <select id={id} className="form-input" required={required} disabled={disabled} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(option => {
          const item = typeof option === 'string' ? { label: option, value: option } : option;
          return <option key={item.value} value={item.value}>{item.label}</option>;
        })}
      </select>
    </div>
  );
}

export function TextAreaField({ label, value, onChange, required, wide = true, placeholder, disabled }: Base) {
  const id = useId();
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="form-label" htmlFor={id}>{label}{required && ' *'}</label>
      <textarea id={id} className="form-input min-h-[80px]" required={required} disabled={disabled} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
