import net from 'node:net';
import { Request } from 'express';

const IPV4_PRIVATE_PREFIXES = ['10.', '127.', '192.168.', '169.254.'];

const normalizeIp = (candidate?: string): string | null => {
  if (!candidate) {
    return null;
  }

  let value = candidate.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
    value = value.slice(1, -1);
  }

  if (value.startsWith('for=')) {
    value = value.slice(4);
  }

  value = value.replace(/^\[|\]$/g, '');

  const ipv4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/.exec(value);
  if (ipv4WithPort) {
    value = ipv4WithPort[1];
  }

  if (value.startsWith('::ffff:')) {
    value = value.slice('::ffff:'.length);
  }

  if (net.isIP(value) === 0) {
    return null;
  }

  return value;
};

const getHeaderValue = (value?: string | string[]): string => {
  if (!value) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.join(',');
  }

  return value;
};

const extractIpsFromHeader = (value?: string | string[]): string[] =>
  getHeaderValue(value)
    .split(',')
    .map((item) => normalizeIp(item))
    .filter((ip): ip is string => !!ip);

const isPrivateIpv4 = (ip: string): boolean => {
  if (IPV4_PRIVATE_PREFIXES.some((prefix) => ip.startsWith(prefix))) {
    return true;
  }

  const octets = ip.split('.').map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
    return false;
  }

  return octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31;
};

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  );
};

export const isPrivateOrLocalIp = (ip: string): boolean => {
  if (net.isIP(ip) === 4) {
    return isPrivateIpv4(ip);
  }

  if (net.isIP(ip) === 6) {
    return isPrivateIpv6(ip);
  }

  return true;
};

export const extractClientIp = (request: Request): string | null => {
  const requestIp = normalizeIp(request.ip);
  const cfConnectingIp = normalizeIp(
    getHeaderValue(request.headers['cf-connecting-ip']),
  );
  const xRealIp = normalizeIp(getHeaderValue(request.headers['x-real-ip']));
  const forwardedIps = extractIpsFromHeader(request.headers['x-forwarded-for']);

  const candidates = [
    requestIp,
    cfConnectingIp,
    ...forwardedIps,
    xRealIp,
  ].filter((ip): ip is string => !!ip);

  const publicCandidate = candidates.find((ip) => !isPrivateOrLocalIp(ip));
  if (publicCandidate) {
    return publicCandidate;
  }

  return candidates[0] ?? null;
};
