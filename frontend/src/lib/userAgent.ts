/**
 * Short device label from a user agent, e.g. "Android · Chrome 131" or "Samsung SM-A155F · Samsung Internet".
 * Browsers stopped sending the phone model in the user agent (Chrome on Android sends "K", iOS
 * never sends it), so the model is only shown when it is actually there.
 */
export function describeUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null
  const os = /iPhone|iPad/.test(ua)
    ? ua.includes('iPad')
      ? 'iPad'
      : 'iPhone'
    : /Android/.test(ua)
      ? 'Android'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null
  const model = /Android [\d.]+; (?!K[);])([^;)]+)\)/.exec(ua)?.[1]?.trim()
  const browser = /SamsungBrowser\/(\d+)/.exec(ua)
    ? `Samsung Internet ${/SamsungBrowser\/(\d+)/.exec(ua)![1]}`
    : /EdgA?\/(\d+)/.exec(ua)
      ? `Edge ${/EdgA?\/(\d+)/.exec(ua)![1]}`
      : /(?:CriOS|Chrome)\/(\d+)/.exec(ua)
        ? `Chrome ${/(?:CriOS|Chrome)\/(\d+)/.exec(ua)![1]}`
        : /(?:FxiOS|Firefox)\/(\d+)/.exec(ua)
          ? `Firefox ${/(?:FxiOS|Firefox)\/(\d+)/.exec(ua)![1]}`
          : /Safari\/\d+/.test(ua) && /Version\/(\d+)/.exec(ua)
            ? `Safari ${/Version\/(\d+)/.exec(ua)![1]}`
            : null
  const parts = [model ? `${os ?? ''} ${model}`.trim() : os, browser].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : ua.slice(0, 60)
}
