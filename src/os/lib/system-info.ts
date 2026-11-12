import type { SystemInfo } from "../shell/types";

/** Best-effort browser name and version from the user agent string. */
export function parseBrowser(ua: string): string {
  const match = (re: RegExp) => re.exec(ua)?.[1];
  const edge = match(/Edg(?:e|A|iOS)?\/([\d.]+)/);
  if (edge) return `Microsoft Edge ${edge.split(".")[0]}`;
  const opera = match(/OPR\/([\d.]+)/);
  if (opera) return `Opera ${opera.split(".")[0]}`;
  const firefox = match(/(?:Firefox|FxiOS)\/([\d.]+)/);
  if (firefox) return `Firefox ${firefox.split(".")[0]}`;
  const chrome = match(/(?:Chrome|CriOS)\/([\d.]+)/);
  if (chrome) return `Chrome ${chrome.split(".")[0]}`;
  const safari = match(/Version\/([\d.]+).*Safari/);
  if (safari) return `Safari ${safari.split(".")[0]}`;
  return "Unknown browser";
}

export function parsePlatform(ua: string, hinted?: string): string {
  if (hinted) return hinted;
  if (/Windows/i.test(ua)) return "Windows";
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
}

/** Only what the browser willingly exposes. Nothing here is guessed or invented. */
export function readSystemInfo(): SystemInfo {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return {
    browser: parseBrowser(nav.userAgent),
    platform: parsePlatform(nav.userAgent, nav.userAgentData?.platform),
    language: nav.language,
    screen: `${window.screen.width}×${window.screen.height}`,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    online: nav.onLine,
  };
}
