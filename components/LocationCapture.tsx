'use client'

import { useState } from 'react'
import { CheckIcon, PinIcon } from '@/components/ui'

export interface Place {
  lat: number
  lng: number
  label: string
}

/**
 * Bangalore neighbourhoods, for the manual fallback when a parent denies geolocation.
 * A dropdown of real areas beats a map pin on a phone: it is one tap, it produces a
 * label the UI can say out loud, and it needs no tiles.
 */
const AREAS: Place[] = [
  { label: 'Kammanahalli', lat: 13.0159, lng: 77.6408 },
  { label: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
  { label: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { label: 'Jayanagar', lat: 12.925, lng: 77.5938 },
  { label: 'Malleshwaram', lat: 13.0035, lng: 77.5709 },
  { label: 'HSR Layout', lat: 12.9121, lng: 77.6446 },
  { label: 'Whitefield', lat: 12.9698, lng: 77.75 },
  { label: 'Hebbal', lat: 13.0358, lng: 77.597 },
  { label: 'Banashankari', lat: 12.925, lng: 77.5468 },
  { label: 'Rajajinagar', lat: 12.9916, lng: 77.5526 },
  { label: 'Marathahalli', lat: 12.9591, lng: 77.6974 },
  { label: 'Yelahanka', lat: 13.1007, lng: 77.5963 },
]

/** Nearest known area to a fix, so we can say "Kammanahalli" without a geocoder. */
export function nearestArea(lat: number, lng: number): string {
  let best = AREAS[0]
  let bestD = Infinity
  for (const a of AREAS) {
    const d = (a.lat - lat) ** 2 + (a.lng - lng) ** 2
    if (d < bestD) {
      bestD = d
      best = a
    }
  }
  return best.label
}

export function LocationCapture({
  value,
  onChange,
}: {
  value: Place | null
  onChange: (p: Place) => void
}) {
  const [state, setState] = useState<'idle' | 'locating' | 'denied'>('idle')

  function locate() {
    if (!navigator.geolocation) {
      setState('denied')
      return
    }
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        onChange({ lat: latitude, lng: longitude, label: nearestArea(latitude, longitude) })
        setState('idle')
      },
      () => setState('denied'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-line bg-[var(--card)] px-4 py-3.5">
        <span className="flex items-center gap-2.5 text-[0.9375rem] font-semibold">
          <CheckIcon className="h-4 w-4 text-grass" />
          {value.label}
        </span>
        <button
          type="button"
          onClick={() => setState('denied')}
          className="text-[0.75rem] font-semibold text-grass underline underline-offset-2"
        >
          Change
        </button>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div>
        <select
          className="w-full appearance-none rounded-xl border border-line bg-[var(--card)] px-4 py-3.5 text-base outline-none focus:border-grass"
          defaultValue=""
          onChange={(e) => {
            const area = AREAS.find((a) => a.label === e.target.value)
            if (area) onChange(area)
          }}
        >
          <option value="" disabled>
            Pick your area
          </option>
          {AREAS.map((a) => (
            <option key={a.label} value={a.label}>
              {a.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={locate}
          className="mt-2 text-[0.75rem] font-semibold text-grass underline underline-offset-2"
        >
          Use my location instead
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={locate}
      disabled={state === 'locating'}
      className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-[var(--card)] px-4 py-3.5 text-left transition hover:border-[var(--muted)] disabled:opacity-60"
    >
      <PinIcon className="h-4 w-4 text-grass" />
      <span className="text-[0.9375rem] font-semibold">
        {state === 'locating' ? 'Finding you…' : 'Use my location'}
      </span>
      <span
        role="presentation"
        onClick={(e) => {
          e.stopPropagation()
          setState('denied')
        }}
        className="ml-auto text-[0.75rem] font-medium text-muted underline underline-offset-2"
      >
        or pick an area
      </span>
    </button>
  )
}
