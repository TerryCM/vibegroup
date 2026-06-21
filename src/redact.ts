export function redactSecrets(text: string, maxChars = 4000): string {
  let out = text
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]')
    .replace(/\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}\b/g, '[REDACTED]')
    .replace(/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[REDACTED]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '[REDACTED]')
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED]')
    .replace(
      /([A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY)[A-Za-z0-9_]*)(\s*[:=]\s*)(\S+)/gi,
      '$1$2[REDACTED]',
    )

  if (out.length > maxChars) out = out.slice(0, maxChars) + '…[truncated]'
  return out
}
