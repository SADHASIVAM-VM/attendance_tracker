import {
  extractCoordinatesFromUrlOrHtml,
  isValidCoordinate,
  isAllowedGoogleMapsHost,
  isPrivateOrLoopbackHost,
  resolveGoogleMapsUrl,
} from '../utils/mapsUrlParser';
import { app } from '../server';
import { getDb } from '../database/db';
import { seedDatabase } from '../database/seed/seed';
import http from 'http';

async function runMapsTests() {
  console.log('🧪 Starting Google Maps URL Extraction & SSRF Security Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // ==========================================
  // SECTION 1: UNIT TESTS FOR PARSING & PRECEDENCE
  // ==========================================
  console.log('--- Section 1: Coordinate Extraction & Precedence ---');

  // Test 1.1: Protobuf Place Pin (!3d, !4d) vs Camera Viewport (@lat,lng)
  // MUST prefer place pin (40.7484405, -73.9856644) over camera (@40.748817, -73.985428)
  const fullPlaceUrl =
    'https://www.google.com/maps/place/Empire+State+Building/@40.748817,-73.985428,17z/data=!4m6!3m5!1s0x89c259a9b3117469:0xd134e199a405a163!8m2!3d40.7484405!4d-73.9856644!16zL20vMDJwbV8?entry=ttu';
  const placeResult = extractCoordinatesFromUrlOrHtml(fullPlaceUrl);
  assert(
    placeResult !== null &&
      placeResult.source === 'place_pin' &&
      placeResult.isPinExact === true &&
      Math.abs(placeResult.latitude - 40.7484405) < 0.0001 &&
      Math.abs(placeResult.longitude - -73.9856644) < 0.0001,
    'Prefers place-pin coordinates (!3d / !4d) over camera viewport coordinates (@lat,lng)'
  );

  // Test 1.2: Query parameter coordinates (?q=lat,lng)
  const queryUrl = 'https://maps.google.com/?q=37.774929,-122.419416';
  const queryResult = extractCoordinatesFromUrlOrHtml(queryUrl);
  assert(
    queryResult !== null &&
      queryResult.source === 'query_param' &&
      queryResult.isPinExact === true &&
      Math.abs(queryResult.latitude - 37.774929) < 0.0001 &&
      Math.abs(queryResult.longitude - -122.419416) < 0.0001,
    'Extracts coordinates accurately from query string (?q=LAT,LNG)'
  );

  // Test 1.3: Search path coordinates (/maps/search/lat,lng)
  const searchUrl = 'https://www.google.com/maps/search/1.283333,103.833333';
  const searchResult = extractCoordinatesFromUrlOrHtml(searchUrl);
  assert(
    searchResult !== null &&
      searchResult.source === 'query_param' &&
      searchResult.isPinExact === true &&
      Math.abs(searchResult.latitude - 1.283333) < 0.0001 &&
      Math.abs(searchResult.longitude - 103.833333) < 0.0001,
    'Extracts coordinates from search path (/maps/search/LAT,LNG)'
  );

  // Test 1.4: HTML itemprop & meta tag extraction
  const sampleHtml = `
    <html>
      <head>
        <meta itemprop="latitude" content="51.507351">
        <meta itemprop="longitude" content="-0.127758">
      </head>
      <body>Map page</body>
    </html>
  `;
  const metaResult = extractCoordinatesFromUrlOrHtml('https://www.google.com/maps/place/London', sampleHtml);
  assert(
    metaResult !== null &&
      metaResult.source === 'meta_tag' &&
      metaResult.isPinExact === true &&
      Math.abs(metaResult.latitude - 51.507351) < 0.0001 &&
      Math.abs(metaResult.longitude - -0.127758) < 0.0001,
    'Extracts coordinates from HTML meta/itemprop tags when URL lacks direct coordinates'
  );

  // Test 1.5: Camera Viewport fallback (@lat,lng) marked as NOT exact pin
  const viewportUrl = 'https://www.google.com/maps/@34.052235,-118.243683,14z';
  const viewportResult = extractCoordinatesFromUrlOrHtml(viewportUrl);
  assert(
    viewportResult !== null &&
      viewportResult.source === 'camera_viewport' &&
      viewportResult.isPinExact === false &&
      Math.abs(viewportResult.latitude - 34.052235) < 0.0001,
    'Flags viewport-only coordinates as approximate (isPinExact === false)'
  );

  // Test 1.6: Boundary coordinates validation (-90 to 90, -180 to 180)
  assert(isValidCoordinate(90, 180), 'Validates maximum geographic boundaries (90, 180)');
  assert(isValidCoordinate(-90, -180), 'Validates minimum geographic boundaries (-90, -180)');
  assert(isValidCoordinate(0, 0), 'Validates equator and prime meridian (0, 0)');
  assert(!isValidCoordinate(91, 50), 'Rejects latitude > 90');
  assert(!isValidCoordinate(-90.5, 50), 'Rejects latitude < -90');
  assert(!isValidCoordinate(50, 181), 'Rejects longitude > 180');
  assert(!isValidCoordinate(50, -180.5), 'Rejects longitude < -180');
  assert(!isValidCoordinate(NaN, 50), 'Rejects NaN coordinate');

  // ==========================================
  // SECTION 2: SSRF DEFENSE & DOMAIN ALLOWLIST
  // ==========================================
  console.log('\n--- Section 2: SSRF Prevention & Security Safeguards ---');

  // Test 2.1: Allowed Google Maps domains
  assert(isAllowedGoogleMapsHost('maps.app.goo.gl'), 'Permits maps.app.goo.gl short links');
  assert(isAllowedGoogleMapsHost('goo.gl'), 'Permits legacy goo.gl links');
  assert(isAllowedGoogleMapsHost('maps.google.com'), 'Permits maps.google.com');
  assert(isAllowedGoogleMapsHost('www.google.com'), 'Permits www.google.com');
  assert(isAllowedGoogleMapsHost('www.google.co.uk'), 'Permits regional google domains (google.co.uk)');
  assert(isAllowedGoogleMapsHost('google.de'), 'Permits regional google domains (google.de)');

  // Test 2.2: Rejection of untrusted / malicious domains
  assert(!isAllowedGoogleMapsHost('evilgoogle.com'), 'Blocks evilgoogle.com');
  assert(!isAllowedGoogleMapsHost('google.com.attacker.io'), 'Blocks subdomain spoofing');
  assert(!isAllowedGoogleMapsHost('maps.app.goo.gl.malicious.net'), 'Blocks domain suffix attack');
  assert(!isAllowedGoogleMapsHost('bing.com'), 'Blocks non-Google search domains');

  // Test 2.3: Rejection of private & loopback addresses
  assert(isPrivateOrLoopbackHost('localhost'), 'Identifies localhost as private/loopback');
  assert(isPrivateOrLoopbackHost('127.0.0.1'), 'Identifies 127.0.0.1 as loopback');
  assert(isPrivateOrLoopbackHost('10.0.0.5'), 'Identifies 10.0.0.0/8 private network');
  assert(isPrivateOrLoopbackHost('192.168.1.100'), 'Identifies 192.168.0.0/16 private network');
  assert(isPrivateOrLoopbackHost('172.16.50.1'), 'Identifies 172.16.0.0/12 private network');
  assert(isPrivateOrLoopbackHost('169.254.169.254'), 'Identifies link-local metadata address');
  assert(isPrivateOrLoopbackHost('::1'), 'Identifies IPv6 loopback');

  // Test 2.4: SSRF resolution rejections in resolveGoogleMapsUrl
  let ssrfBlocked = false;
  try {
    await resolveGoogleMapsUrl('http://maps.google.com/test');
  } catch (err: any) {
    if (err.message.includes('INSECURE_PROTOCOL')) ssrfBlocked = true;
  }
  assert(ssrfBlocked, 'Blocks unencrypted HTTP protocols (INSECURE_PROTOCOL)');

  let hostBlocked = false;
  try {
    await resolveGoogleMapsUrl('https://evil-maps.attacker.org/?q=10,20');
  } catch (err: any) {
    if (err.message.includes('UNAPPROVED_DOMAIN')) hostBlocked = true;
  }
  assert(hostBlocked, 'Blocks unapproved hostnames (UNAPPROVED_DOMAIN)');

  let loopbackBlocked = false;
  try {
    await resolveGoogleMapsUrl('https://localhost:5000/internal-data');
  } catch (err: any) {
    if (err.message.includes('SSRF_DENIED') || err.message.includes('UNAPPROVED_DOMAIN')) loopbackBlocked = true;
  }
  assert(loopbackBlocked, 'Blocks loopback network requests (SSRF_DENIED)');
  // ==========================================
  // SECTION 3: HTTP API INTEGRATION TESTS
  // ==========================================
  console.log('\n--- Section 3: REST API Integration Endpoints ---');

  await getDb();
  await seedDatabase();

  const testPort = 5005;
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(testPort, () => resolve(s));
  });
  const baseUrl = `http://localhost:${testPort}`;

  // Helper for requests
  async function api(path: string, options: any = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // 3.1 Login as Admin
  const adminLogin = await api('/api/v1/auth/login', {
    method: 'POST',
    body: { email: 'admin@enterprise.com', password: 'Password123!' },
  });
  assert(adminLogin.status === 200 && !!adminLogin.data.token, 'Admin authentication successful');
  const adminToken = adminLogin.data.token;

  // 3.2 Test /api/v1/worksites/extract-coordinates with valid place URL
  const extractResV1 = await api('/api/v1/worksites/extract-coordinates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { mapsUrl: fullPlaceUrl },
  });
  assert(
    extractResV1.status === 200 &&
      Math.abs(extractResV1.data.latitude - 40.7484405) < 0.0001 &&
      Math.abs(extractResV1.data.longitude - -73.9856644) < 0.0001 &&
      extractResV1.data.isPinExact === true,
    'POST /api/v1/worksites/extract-coordinates successfully resolves place pin'
  );

  // 3.3 Test /api/worksites/extract-coordinates root alias
  const extractResRoot = await api('/api/worksites/extract-coordinates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { mapsUrl: queryUrl },
  });
  assert(
    extractResRoot.status === 200 &&
      Math.abs(extractResRoot.data.latitude - 37.774929) < 0.0001 &&
      Math.abs(extractResRoot.data.longitude - -122.419416) < 0.0001,
    'POST /api/worksites/extract-coordinates (root alias) functions identically'
  );

  // 3.4 Test failure case with invalid URL
  const invalidUrlRes = await api('/api/v1/worksites/extract-coordinates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { mapsUrl: 'not-a-valid-url' },
  });
  assert(invalidUrlRes.status === 400, 'Rejects malformed string with HTTP 400 error response');

  // 3.5 Test rejection of SSRF attempt via API
  const ssrfAttemptRes = await api('/api/v1/worksites/extract-coordinates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { mapsUrl: 'http://localhost:5000/api/v1/audit/logs' },
  });
  assert(
    ssrfAttemptRes.status === 400 &&
      (ssrfAttemptRes.data.error === 'INSECURE_PROTOCOL' || ssrfAttemptRes.data.error === 'SSRF_DENIED'),
    'Blocks SSRF attack targeting internal API with explicit error message'
  );

  // 3.6 Test that failed extraction NEVER creates a fake or zero worksite in DB
  const initialWorksites = await api('/api/v1/worksites', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const initialCount = initialWorksites.data.length;

  // Run failed extraction
  await api('/api/v1/worksites/extract-coordinates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { mapsUrl: 'https://www.google.com/maps/about' },
  });

  const postWorksites = await api('/api/v1/worksites', {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(
    postWorksites.data.length === initialCount,
    'Failed coordinate extraction never creates a fake or zero-coordinate worksite in DB'
  );

  server.close();

  console.log(`\n==========================================`);
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log(`==========================================`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMapsTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
