import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { SiteCheckFinding, SiteCheckResult } from '@/lib/ga4/types';

const MAX_REDIRECTS = 3;
const MAX_HTML_LENGTH = 500_000;
const SITE_CHECK_USER_AGENT = 'GA4-Learning-Lab-Site-Check/1.0';

export async function auditPublicSite(input: string): Promise<SiteCheckResult> {
  const requestedUrl = normalizeSiteUrlInput(input);
  let currentUrl = requestedUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertPublicSiteUrl(currentUrl);

    const response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      cache: 'no-store',
      headers: {
        'User-Agent': SITE_CHECK_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml'
      }
    });

    if (isRedirect(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('リダイレクト先を取得できませんでした。');
      }

      currentUrl = new URL(location, currentUrl);
      continue;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      throw new Error('HTML ページではないため確認できませんでした。');
    }

    const html = (await response.text()).slice(0, MAX_HTML_LENGTH);
    const result = buildSiteCheckResult(requestedUrl, currentUrl, response.status, html);

    if (!response.ok) {
      result.findings.unshift({
        level: 'warn',
        title: '正常なステータスではありません',
        detail: `HTTP ${response.status} を返しています。公開状態やアクセス制限を確認してください。`
      });
    }

    return result;
  }

  throw new Error('リダイレクトが多すぎます。');
}

export function normalizeSiteUrlInput(input: string) {
  const raw = input.trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return new URL(withProtocol);
}

export async function assertPublicSiteUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('http または https の URL を入力してください。');
  }

  if (url.username || url.password) {
    throw new Error('認証情報付き URL は使えません。');
  }

  if (url.port && !['80', '443'].includes(url.port)) {
    throw new Error('80 / 443 以外のポートは確認対象外です。');
  }

  if (isRestrictedHostname(url.hostname)) {
    throw new Error('ローカル / 社内向けアドレスは確認対象外です。');
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (!addresses.length) {
    throw new Error('URL の名前解決に失敗しました。');
  }

  for (const { address } of addresses) {
    if (!isPublicIpAddress(address)) {
      throw new Error('ローカル / 社内向けアドレスは確認対象外です。');
    }
  }
}

export function buildSiteCheckResult(
  requestedUrl: URL,
  finalUrl: URL,
  statusCode: number,
  html: string
): SiteCheckResult {
  const normalizedHtml = html.slice(0, MAX_HTML_LENGTH);
  const measurementIds = Array.from(new Set(normalizedHtml.match(/\bG-[A-Z0-9]{6,}\b/g) ?? [])).slice(0, 5);
  const hasGtag =
    /googletagmanager\.com\/gtag\/js/i.test(normalizedHtml) ||
    /\bgtag\s*\(/i.test(normalizedHtml);
  const hasGtm =
    /googletagmanager\.com\/gtm\.js/i.test(normalizedHtml) ||
    /\bGTM-[A-Z0-9]{4,}\b/i.test(normalizedHtml);
  const hasDataLayer = /\bdataLayer\b/.test(normalizedHtml);
  const title = readTagText(normalizedHtml, 'title');
  const description = readMetaContent(normalizedHtml, 'description');
  const robots = readMetaContent(normalizedHtml, 'robots');
  const canonicalUrl = readCanonicalHref(normalizedHtml);

  return {
    requestedUrl: requestedUrl.toString(),
    finalUrl: finalUrl.toString(),
    statusCode,
    title,
    description,
    canonicalUrl,
    robots,
    hasGtag,
    hasGtm,
    hasDataLayer,
    measurementIds,
    findings: buildSiteFindings({
      title,
      description,
      canonicalUrl,
      robots,
      hasGtag,
      hasGtm,
      hasDataLayer,
      measurementIds
    })
  };
}

export function isPublicIpAddress(address: string) {
  const ipVersion = isIP(address);
  if (ipVersion === 4) {
    const [a, b, c] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a === 192 && b === 0 && c === 2) return false;
    if (a === 198 && b === 51 && c === 100) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    if (a >= 224) return false;
    return true;
  }

  if (ipVersion === 6) {
    const value = address.toLowerCase();
    if (value === '::1' || value === '::') return false;
    if (value.startsWith('fc') || value.startsWith('fd')) return false;
    if (value.startsWith('fe80')) return false;
    if (value.startsWith('::ffff:')) {
      const mapped = value.split('::ffff:')[1];
      return isPublicIpAddress(mapped);
    }
    if (value.startsWith('2001:db8')) return false;
    return true;
  }

  return false;
}

function isRedirect(status: number) {
  return status >= 300 && status < 400;
}

function isRestrictedHostname(hostname: string) {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.localhost')) return true;
  if (lower.endsWith('.local') || lower.endsWith('.internal')) return true;
  if (lower.endsWith('.home.arpa')) return true;
  if (isIP(lower)) {
    return !isPublicIpAddress(lower);
  }
  return false;
}

function readTagText(html: string, tagName: string) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match ? decodeHtml(match[1]).trim().slice(0, 160) : null;
}

function readMetaContent(html: string, name: string) {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${escapeRegExp(name)}["'][^>]+content=["']([^"']*)["'][^>]*>`,
    'i'
  );
  const match = html.match(pattern);
  return match ? decodeHtml(match[1]).trim().slice(0, 220) : null;
}

function readCanonicalHref(html: string) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  return match ? decodeHtml(match[1]).trim().slice(0, 220) : null;
}

function buildSiteFindings(input: {
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  hasGtag: boolean;
  hasGtm: boolean;
  hasDataLayer: boolean;
  measurementIds: string[];
}): SiteCheckFinding[] {
  const findings: SiteCheckFinding[] = [];

  if (input.measurementIds.length) {
    findings.push({
      level: 'good',
      title: 'GA4 測定IDを検出しました',
      detail: `検出した ID: ${input.measurementIds.join(', ')}`
    });
  } else if (input.hasGtm) {
    findings.push({
      level: 'info',
      title: 'GTM は見つかりました',
      detail: 'ただし、このページ HTML だけでは GTM 内の GA4 設定までは確定できません。'
    });
  } else {
    findings.push({
      level: 'warn',
      title: 'GA4 / GTM タグを検出できませんでした',
      detail: 'この URL にタグが未設置か、JavaScript 実行後にのみ読み込まれている可能性があります。'
    });
  }

  if (!input.title) {
    findings.push({
      level: 'warn',
      title: 'ページ title が空です',
      detail: '検索結果や共有表示の見え方に影響します。'
    });
  }

  if (!input.description) {
    findings.push({
      level: 'info',
      title: 'meta description が見つかりません',
      detail: 'SEO と共有時の説明文を整える余地があります。'
    });
  }

  if (!input.canonicalUrl) {
    findings.push({
      level: 'info',
      title: 'canonical が見つかりません',
      detail: 'URL の重複が起きやすいサイトでは canonical の整理が有効です。'
    });
  }

  if (input.robots?.toLowerCase().includes('noindex')) {
    findings.push({
      level: 'warn',
      title: 'noindex が設定されています',
      detail: '意図しない noindex だと検索流入や計測結果の評価に影響します。'
    });
  }

  if (input.hasDataLayer && !input.hasGtag && !input.hasGtm) {
    findings.push({
      level: 'info',
      title: 'dataLayer はあります',
      detail: 'タグマネージャーや別の計測連携の準備だけが残っている可能性があります。'
    });
  }

  return findings;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
