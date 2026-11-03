import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const passwordBytes = 64;

export function parseTeamUsers(value) {
  if (!value) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('PACKPROOF_TEAM_USERS must be a JSON array of named users.');
  }
  if (!Array.isArray(parsed) || parsed.length < 2) {
    throw new Error('Configure at least one admin and one reviewer in PACKPROOF_TEAM_USERS.');
  }
  const ids = new Set();
  const configuredPasswords = new Set();
  const users = parsed.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('Each team user must be an object.');
    const username = String(item.username || '').trim();
    const id = username.toLowerCase();
    const displayName = String(item.displayName || username).trim();
    const role = item.role;
    const password = item.password;
    if (!/^[a-zA-Z0-9._@-]{2,80}$/.test(username) || ids.has(id)) {
      throw new Error('Team usernames must be unique and contain 2–80 letters, digits, dots, underscores, @, or hyphens.');
    }
    if (!displayName || displayName.length > 100) throw new Error(`Invalid display name for ${username}.`);
    if (!['admin', 'reviewer'].includes(role)) throw new Error(`Role for ${username} must be admin or reviewer.`);
    if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
      throw new Error(`Use a 12–256 character password for ${username}.`);
    }
    if (configuredPasswords.has(password)) throw new Error('Use a different password for each named team account.');
    ids.add(id);
    configuredPasswords.add(password);
    const salt = randomBytes(16);
    return Object.freeze({
      id,
      username,
      displayName,
      role,
      salt,
      passwordHash: scryptSync(password, salt, passwordBytes),
    });
  });
  if (!users.some((user) => user.role === 'admin') || !users.some((user) => user.role === 'reviewer')) {
    throw new Error('PACKPROOF_TEAM_USERS needs at least one admin and one reviewer.');
  }
  return users;
}

export function authenticateTeamUser(header, users) {
  if (!Array.isArray(users) || users.length === 0) return null;
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return null;
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return null;
  }
  const separator = decoded.indexOf(':');
  if (separator < 1) return null;
  const username = decoded.slice(0, separator).toLowerCase();
  const password = decoded.slice(separator + 1);
  const user = users.find((item) => item.id === username);
  if (!user) return null;
  const candidate = scryptSync(password, user.salt, passwordBytes);
  if (!timingSafeEqual(candidate, user.passwordHash)) return null;
  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role };
}

export function authenticateLegacyUser(header, username, password) {
  if (!password || typeof header !== 'string' || !header.startsWith('Basic ')) return null;
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch {
    return null;
  }
  const expected = Buffer.from(`${username}:${password}`);
  const supplied = Buffer.from(decoded);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  return { id: 'legacy-admin', username, displayName: 'Workspace admin', role: 'admin' };
}
