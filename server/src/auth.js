import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { db } from './db.js';

const tokenSecret = process.env.SESSION_SECRET || 'dev-session-secret-change-before-production';
const oneWeekInSeconds = 7 * 24 * 60 * 60;

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(value) {
  return createHmac('sha256', tokenSecret).update(value).digest('base64url');
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');

  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedPassword) {
  const [salt, storedHash] = storedPassword.split(':');

  if (!salt || !storedHash) {
    return false;
  }

  const hash = scryptSync(password, salt, 64);
  const storedHashBuffer = Buffer.from(storedHash, 'hex');

  return hash.length === storedHashBuffer.length && timingSafeEqual(hash, storedHashBuffer);
}

export function createToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + oneWeekInSeconds
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  const expectedSignature = sign(encodedPayload);

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    if (!payload.sub || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

export function requireAuth(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const user = db
    .prepare('SELECT id, name, email FROM users WHERE id = ?')
    .get(payload.sub);

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  req.user = user;
  return next();
}
