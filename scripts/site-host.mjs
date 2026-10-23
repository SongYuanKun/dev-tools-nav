/**
 * Canonical host helpers for SEO and GitHub Pages → custom-domain consolidation.
 * Keep the redirect rules in js/base.js in sync with resolveGithubPagesRedirect().
 */

export const CANONICAL_ORIGIN = "https://tools.songyuankun.top";
export const GITHUB_PAGES_HOST_SUFFIX = ".github.io";
export const GITHUB_PAGES_BASE_PATH = "/dev-tools-nav";

/**
 * @param {{ hostname: string, pathname?: string, search?: string, hash?: string }} locationLike
 * @returns {string | null} Absolute custom-domain URL, or null when no redirect is needed.
 */
export function resolveGithubPagesRedirect(locationLike) {
  const hostname = String(locationLike?.hostname || "");
  if (!hostname.endsWith(GITHUB_PAGES_HOST_SUFFIX)) return null;

  const pathname = String(locationLike?.pathname || "/");
  const base = GITHUB_PAGES_BASE_PATH;
  if (pathname !== base && pathname !== `${base}/` && !pathname.startsWith(`${base}/`)) {
    return null;
  }

  let rest = pathname === base || pathname === `${base}/`
    ? "/"
    : pathname.slice(base.length);
  if (!rest.startsWith("/")) rest = `/${rest}`;

  const search = String(locationLike?.search || "");
  const hash = String(locationLike?.hash || "");
  return `${CANONICAL_ORIGIN}${rest}${search}${hash}`;
}

/**
 * @param {string} pathname site-relative path beginning with /
 */
export function canonicalUrlForPath(pathname) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${CANONICAL_ORIGIN}${path}`;
}
