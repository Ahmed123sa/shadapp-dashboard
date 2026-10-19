'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * Small building blocks for the client portal (Luxe design). All visual
 * rules live in src/styles/client-portal.css under `.cx-root`; these only
 * emit the mockup's class names so screens stay thin.
 */

export type DotTone = 'ok' | 'wait' | 'crimson' | 'faint';

const DOT_CLASS: Record<DotTone, string> = { ok: '', wait: 'w', crimson: 'c', faint: 'g' };

/** Status = dot + word, four colours only. */
export function StatusDot({ tone = 'ok', children }: { tone?: DotTone; children?: ReactNode }) {
  const dot = <span className={`dot ${DOT_CLASS[tone]}`.trim()} aria-hidden="true" />;
  if (children === undefined) return dot;
  return (
    <span className="st2">
      {dot}
      {children}
    </span>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'quiet' | 'danger';
  size?: 'md' | 'sm' | 'lg';
};

export function Btn({ variant = 'default', size = 'md', className = '', type = 'button', ...rest }: BtnProps) {
  const cls = ['btn', variant !== 'default' ? variant : '', size !== 'md' ? size : '', className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={cls} {...rest} />;
}

interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** Accessible toggle drawn with the mockup's `.sw2` track. */
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`sw2 ${checked ? 'on' : ''}`.trim()}
    />
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}

export function Segmented<T extends string>({ value, onChange, options }: SegmentedProps<T>) {
  return (
    <div className="segm" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Avatar({ name, src, size }: { name: string; src?: string | null; size?: number }) {
  const style = size ? { width: size, height: size, fontSize: Math.round(size * 0.39) } : undefined;
  return (
    <div className="av" style={style} aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        (name.trim()[0] ?? '').toUpperCase()
      )}
    </div>
  );
}
