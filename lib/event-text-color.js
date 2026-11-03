export const DEFAULT_EVENT_TEXT_COLOR = '#263427'

// Accept only hexadecimal RGB; never pass arbitrary input to CSS or Pango.
export function parseEventTextColor(value) {
 if(typeof value !== 'string')return null
 const hex=value.trim().replace(/^#/, '')
 if(/^[0-9a-f]{6}$/i.test(hex))return `#${hex.toUpperCase()}`
 if(/^[0-9a-f]{3}$/i.test(hex))return `#${hex.split('').map(c=>c+c).join('').toUpperCase()}`
 return null
}
export function eventTextColor(value) {
 return parseEventTextColor(value)||DEFAULT_EVENT_TEXT_COLOR
}

export function eventTextWeight(value) { return value === 'bold' ? 'bold' : 'normal' }
