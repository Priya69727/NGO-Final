import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumber,
  type CountryCode,
} from 'libphonenumber-js';

const countries = getCountries();
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

function flag(country: CountryCode): string {
  return String.fromCodePoint(...country.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0)));
}

function parseValue(value: string) {
  if (!value) return null;
  try {
    const parsed = parsePhoneNumber(value, 'IN');
    if (parsed.country) return { country: parsed.country, nationalNumber: parsed.nationalNumber };
  } catch {
    return null;
  }
  return null;
}

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
}

export default function PhoneField({ label, value, onChange, required, error }: Props) {
  const initial = useMemo(() => parseValue(value), []);
  const [country, setCountry] = useState<CountryCode>(initial?.country ?? 'IN');
  const [nationalNumber, setNationalNumber] = useState(initial?.nationalNumber ?? '');
  const [inputError, setInputError] = useState('');
  const [touched, setTouched] = useState(false);
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const parsed = parseValue(value);
    if (parsed) {
      setCountry(parsed.country);
      setNationalNumber(parsed.nationalNumber);
    } else if (!value) {
      setNationalNumber('');
    }
  }, [value]);

  const callingCode = getCountryCallingCode(country);
  const digits = nationalNumber.replace(/\D/g, '');
  const fullNumber = digits ? `+${callingCode}${digits}` : '';
  const valid = fullNumber ? isValidPhoneNumber(fullNumber) : false;
  const localError = nationalNumber && !valid
    ? country === 'IN' && digits.length !== 10
      ? 'Indian phone numbers must contain exactly 10 digits.'
      : 'Enter a valid phone number for the selected country.'
    : '';
  const message = error || inputError || (touched ? localError : '');
  const id = `phone-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const errorId = `${id}-error`;

  return (
    <div className="min-w-0 sm:col-span-2">
      <label className="form-label" htmlFor={`${id}-number`}>
        {label}{required && <span className="ml-1 text-rose-600" aria-hidden="true">*</span>}
      </label>
      <div className="grid min-w-0 grid-cols-[minmax(110px,0.85fr)_minmax(0,1.15fr)] gap-2">
        <select
          aria-label="Country calling code"
          className="form-input min-w-0"
          value={country}
          onChange={event => {
            const next = event.target.value as CountryCode;
            setCountry(next);
            setTouched(true);
            const nextCode = getCountryCallingCode(next);
            const nextValue = digits ? `+${nextCode}${digits}` : '';
            lastEmitted.current = nextValue;
            onChange(nextValue);
          }}
        >
          {countries.map(item => (
            <option key={item} value={item}>
              {flag(item)} {countryNames.of(item) ?? item} (+{getCountryCallingCode(item)})
            </option>
          ))}
        </select>
        <div className="flex min-w-0">
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-2.5 text-sm text-slate-600">
            +{callingCode}
          </span>
          <input
            id={`${id}-number`}
            className={`form-input w-full min-w-0 flex-1 rounded-l-none ${message ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''}`}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={nationalNumber}
            required={required}
            aria-invalid={Boolean(message)}
            aria-describedby={message ? errorId : undefined}
            onBlur={() => setTouched(true)}
            onChange={event => {
              const next = event.target.value;
              if (!/^[\d\s().-]*$/.test(next)) {
                setInputError('Use digits only; spaces, parentheses, dots, and hyphens are allowed.');
                return;
              }
              setInputError('');
              setNationalNumber(next);
              const compact = next.replace(/\D/g, '');
              const nextValue = compact ? `+${callingCode}${compact}` : '';
              lastEmitted.current = nextValue;
              onChange(nextValue);
            }}
          />
        </div>
      </div>
      {message && <p id={errorId} className="mt-1 text-xs text-rose-600" role="alert">{message}</p>}
    </div>
  );
}
