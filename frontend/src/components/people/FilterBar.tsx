import { useRef, type ReactNode } from 'react';
import { Search } from 'lucide-react';

export interface FilterDef { label: string; value: string; options: string[]; onChange: (v: string) => void }

interface Props { search: string; onSearch: (v: string) => void; placeholder?: string; filters?: FilterDef[]; children?: ReactNode }

export default function FilterBar({ search, onSearch, placeholder = 'Search…', filters = [], children }: Props) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full flex-[1_1_100%] sm:min-w-[220px] sm:max-w-sm sm:flex-[1_1_260px]">
        <div className="search-control">
          <input ref={searchInputRef} className="form-input" placeholder={placeholder} aria-label={placeholder} value={search} onChange={e => onSearch(e.target.value)} />
          <button type="button" className="search-control-button" aria-label="Focus search field" onClick={() => searchInputRef.current?.focus()}>
            <Search size={16} aria-hidden />
          </button>
        </div>
      </div>
      {filters.map(f => (
        <select key={f.label} className="form-input min-w-0 flex-[1_1_145px] sm:w-auto sm:flex-none" aria-label={`Filter by ${f.label}`} value={f.value} onChange={e => f.onChange(e.target.value)}>
          <option value="All">All {f.label}</option>
          {f.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ))}
      {children}
    </div>
  );
}
