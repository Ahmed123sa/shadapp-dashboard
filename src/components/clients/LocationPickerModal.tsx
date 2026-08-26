'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { X, Search, Check } from 'lucide-react';

// Leaflet touches `window` at import time, so it can never be part of the
// server-rendered bundle — load it client-side only.
const LocationPickerMap = dynamic(() => import('./LocationPickerMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '360px' }} className="flex items-center justify-center bg-[var(--color-input-fill)] rounded-lg text-sm text-[var(--color-text-secondary)]">
      ...
    </div>
  ),
});

interface Props {
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string | null;
  onConfirm: (lat: number, lng: number, address: string) => Promise<void> | void;
  onClose: () => void;
}

export default function LocationPickerModal({ initialLat, initialLng, initialAddress, onConfirm, onClose }: Props) {
  const t = useTranslations('dashboard');
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(
    typeof initialLat === 'number' && typeof initialLng === 'number' ? { lat: initialLat, lng: initialLng } : null
  );
  const [address, setAddress] = useState(initialAddress || '');
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [saving, setSaving] = useState(false);
  // Search already gives us a display_name for the picked point — skip the
  // extra reverse-geocode call that would otherwise fire right after.
  const skipNextReverseGeocode = useRef(false);

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) {
        setSearchError(t('location_picker_search_no_results'));
        return;
      }
      const { lat, lon, display_name } = results[0];
      skipNextReverseGeocode.current = true;
      setFlyTo([parseFloat(lat), parseFloat(lon)]);
      setSelected({ lat: parseFloat(lat), lng: parseFloat(lon) });
      if (display_name) setAddress(display_name);
    } catch {
      setSearchError(t('location_picker_search_failed'));
    } finally {
      setSearching(false);
    }
  };

  const handleMapChange = async (lat: number, lng: number) => {
    setSelected({ lat, lng });
    if (skipNextReverseGeocode.current) {
      skipNextReverseGeocode.current = false;
      return;
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data?.display_name) setAddress(data.display_name);
    } catch {
      // Best-effort — the manager can still type the address manually below.
    }
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await onConfirm(selected.lat, selected.lng, address.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="bg-[var(--color-card)] border border-[var(--color-card-border)] rounded-xl w-full max-w-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{t('location_picker_title')}</h3>
          <button onClick={onClose} aria-label={t('close')} className="text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)]">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <p className="text-xs text-[var(--color-text-secondary)]">{t('location_picker_hint')}</p>

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
            placeholder={t('location_picker_search_ph')}
            className="flex-1 bg-[var(--color-input-fill)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)]"
          />
          <button
            onClick={runSearch}
            disabled={searching || !query.trim()}
            className="inline-flex items-center gap-1.5 bg-[var(--color-input-fill)] border border-[var(--color-card-border)] px-3 py-2 rounded-lg text-xs disabled:opacity-50"
          >
            <Search size={14} strokeWidth={1.5} /> {searching ? '...' : t('location_picker_search_btn')}
          </button>
        </div>
        {searchError && <p className="text-xs text-[var(--color-primary-light)]">{searchError}</p>}

        <LocationPickerMap
          initialLat={initialLat}
          initialLng={initialLng}
          flyTo={flyTo}
          onChange={handleMapChange}
        />

        {selected && (
          <p dir="ltr" className="text-xs text-[var(--color-text-secondary)]">
            {t('profile_latitude')}: {selected.lat.toFixed(6)} • {t('profile_longitude')}: {selected.lng.toFixed(6)}
          </p>
        )}

        <div>
          <label className="text-xs text-[var(--color-text-secondary)]">{t('location_picker_address_label')}</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="w-full mt-1 bg-[var(--color-input-fill)] border border-[var(--color-card-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-gold)] resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs border border-[var(--color-card-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-foreground)]">
            {t('cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || saving}
            className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
          >
            <Check size={14} strokeWidth={1.5} /> {saving ? '...' : t('location_picker_confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
