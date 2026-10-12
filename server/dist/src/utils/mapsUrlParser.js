import { URL } from 'url';
// Regex patterns
const PIN_PROTOBUF_REGEX = /!3d(-?\d+(?:\.\d+)?)\s*!4d(-?\d+(?:\.\d+)?)/;
const QUERY_COORD_REGEX = /(?:[?&](?:q|query|ll|saddr|daddr)=)(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/;
const CAMERA_VIEWPORT_REGEX = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const SEARCH_PATH_COORD_REGEX = /\/maps\/(?:search|place)\/(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/;
const META_CENTER_REGEX = /center=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/;
const ITEMPROP_LAT_REGEX = /itemprop=["']latitude["']\s+content=["'](-?\d+(?:\.\d+)?)["']/;
const ITEMPROP_LNG_REGEX = /itemprop=["']longitude["']\s+content=["'](-?\d+(?:\.\d+)?)["']/;
/**
 * Validates coordinate ranges (-90 to 90, -180 to 180).
 */
export function isValidCoordinate(lat, lng) {
    return (!isNaN(lat) &&
        !isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180);
}
/**
 * Checks if a hostname belongs to approved Google Maps domains.
 */
export function isAllowedGoogleMapsHost(hostname) {
    const host = hostname.toLowerCase();
    if (host === 'maps.app.goo.gl' || host === 'goo.gl') {
        return true;
    }
    // Check google.*, maps.google.*, www.google.*
    const googleDomainRegex = /^(?:(?:www|maps)\.)?google\.(?:com|[a-z]{2,3}(?:\.[a-z]{2})?)$/;
    return googleDomainRegex.test(host);
}
/**
 * Disallows private / loopback IP addresses to prevent SSRF.
 */
export function isPrivateOrLoopbackHost(hostname) {
    const host = hostname.toLowerCase();
    if (host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '0.0.0.0' ||
        host.endsWith('.local') ||
        host.endsWith('.internal')) {
        return true;
    }
    // Check IPv4 private subnets
    const ipMatch = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipMatch) {
        const [, a, b] = ipMatch.map(Number);
        if (a === 10)
            return true; // 10.0.0.0/8
        if (a === 127)
            return true; // 127.0.0.0/8
        if (a === 169 && b === 254)
            return true; // 169.254.0.0/16
        if (a === 172 && b >= 16 && b <= 31)
            return true; // 172.16.0.0/12
        if (a === 192 && b === 168)
            return true; // 192.168.0.0/16
    }
    return false;
}
/**
 * Extracts coordinates from a URL string or HTML content, prioritizing place-pin over camera-viewport.
 */
export function extractCoordinatesFromUrlOrHtml(urlStr, htmlContent = '') {
    // 1. Highest Priority: Place-Pin Protobuf (!3dLAT!4dLNG)
    const pinMatch = urlStr.match(PIN_PROTOBUF_REGEX);
    if (pinMatch) {
        const lat = parseFloat(pinMatch[1]);
        const lng = parseFloat(pinMatch[2]);
        if (isValidCoordinate(lat, lng)) {
            return { latitude: lat, longitude: lng, source: 'place_pin', isPinExact: true };
        }
    }
    // 2. Query param coordinates (e.g. ?q=37.7749,-122.4194)
    const queryMatch = urlStr.match(QUERY_COORD_REGEX);
    if (queryMatch) {
        const lat = parseFloat(queryMatch[1]);
        const lng = parseFloat(queryMatch[2]);
        if (isValidCoordinate(lat, lng)) {
            return { latitude: lat, longitude: lng, source: 'query_param', isPinExact: true };
        }
    }
    // 3. Search path coordinates (e.g. /maps/search/37.7749,-122.4194)
    const searchMatch = urlStr.match(SEARCH_PATH_COORD_REGEX);
    if (searchMatch) {
        const lat = parseFloat(searchMatch[1]);
        const lng = parseFloat(searchMatch[2]);
        if (isValidCoordinate(lat, lng)) {
            return { latitude: lat, longitude: lng, source: 'query_param', isPinExact: true };
        }
    }
    // 4. HTML meta tags if available
    if (htmlContent) {
        const metaMatch = htmlContent.match(META_CENTER_REGEX);
        if (metaMatch) {
            const lat = parseFloat(metaMatch[1]);
            const lng = parseFloat(metaMatch[2]);
            if (isValidCoordinate(lat, lng)) {
                return { latitude: lat, longitude: lng, source: 'meta_tag', isPinExact: true };
            }
        }
        const latMatch = htmlContent.match(ITEMPROP_LAT_REGEX);
        const lngMatch = htmlContent.match(ITEMPROP_LNG_REGEX);
        if (latMatch && lngMatch) {
            const lat = parseFloat(latMatch[1]);
            const lng = parseFloat(lngMatch[1]);
            if (isValidCoordinate(lat, lng)) {
                return { latitude: lat, longitude: lng, source: 'meta_tag', isPinExact: true };
            }
        }
    }
    // 5. Camera Viewport (@LAT,LNG) as fallback (noting it is camera-viewport)
    const cameraMatch = urlStr.match(CAMERA_VIEWPORT_REGEX);
    if (cameraMatch) {
        const lat = parseFloat(cameraMatch[1]);
        const lng = parseFloat(cameraMatch[2]);
        if (isValidCoordinate(lat, lng)) {
            return { latitude: lat, longitude: lng, source: 'camera_viewport', isPinExact: false };
        }
    }
    return null;
}
/**
 * Resolves short links by following HTTP redirects securely with hop limits and SSRF checks.
 */
export async function resolveGoogleMapsUrl(initialUrl) {
    let currentUrl = initialUrl.trim();
    const maxRedirects = 6;
    const timeoutMs = 8000;
    for (let hop = 0; hop < maxRedirects; hop++) {
        let parsedUrl;
        try {
            parsedUrl = new URL(currentUrl);
        }
        catch {
            throw new Error('INVALID_URL: The provided Google Maps link is not a valid URL.');
        }
        // SSRF Check: Require HTTPS
        if (parsedUrl.protocol !== 'https:') {
            throw new Error('INSECURE_PROTOCOL: Only secure HTTPS Google Maps links are permitted.');
        }
        // SSRF Check: Hostname validation
        if (isPrivateOrLoopbackHost(parsedUrl.hostname)) {
            throw new Error('SSRF_DENIED: Access to private or loopback networks is blocked.');
        }
        if (!isAllowedGoogleMapsHost(parsedUrl.hostname)) {
            throw new Error(`UNAPPROVED_DOMAIN: Domain "${parsedUrl.hostname}" is not an authorized Google Maps domain.`);
        }
        // Immediate extraction attempt on URL string before fetching
        const quickExtract = extractCoordinatesFromUrlOrHtml(currentUrl);
        if (quickExtract && quickExtract.isPinExact) {
            return {
                ...quickExtract,
                resolvedUrl: currentUrl,
            };
        }
        // Fetch with redirect: 'manual' to inspect every redirect hop
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        let res;
        try {
            res = await fetch(currentUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
                redirect: 'manual',
                signal: controller.signal,
            });
        }
        catch (err) {
            if (err.name === 'AbortError') {
                throw new Error('REQUEST_TIMEOUT: Fetch timed out while resolving Google Maps URL.');
            }
            throw new Error(`CONNECTION_ERROR: Failed to reach Google Maps: ${err.message}`);
        }
        finally {
            clearTimeout(timeoutId);
        }
        // Check for HTTP Redirect (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(res.status)) {
            const location = res.headers.get('location');
            if (!location) {
                break;
            }
            // Resolve relative redirect or full redirect
            currentUrl = new URL(location, currentUrl).toString();
            // Check coordinates in new location URL
            const extractInLocation = extractCoordinatesFromUrlOrHtml(currentUrl);
            if (extractInLocation && extractInLocation.isPinExact) {
                return {
                    ...extractInLocation,
                    resolvedUrl: currentUrl,
                };
            }
            continue;
        }
        // Non-redirect response: inspect final URL and response body
        const html = await res.text().catch(() => '');
        const finalExtract = extractCoordinatesFromUrlOrHtml(currentUrl, html);
        if (finalExtract) {
            return {
                ...finalExtract,
                resolvedUrl: currentUrl,
            };
        }
        break;
    }
    // Final check on current URL in case loop ended
    const lastExtract = extractCoordinatesFromUrlOrHtml(currentUrl);
    if (lastExtract) {
        return {
            ...lastExtract,
            resolvedUrl: currentUrl,
        };
    }
    throw new Error('NO_COORDINATES_FOUND: Could not extract pinned geographic coordinates from the provided Google Maps link. Please select a specific place or pin in Google Maps or enter coordinates manually.');
}
