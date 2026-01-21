# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | ✅ Yes             |
| < 1.0   | ❌ No              |

## Reporting a Vulnerability

If you discover a security vulnerability, please open a [GitHub Issue](../../issues) or submit a [Pull Request](../../pulls) with a fix.

For sensitive issues, you can use GitHub's [private vulnerability reporting](../../security/advisories/new).

## Security Notes

- The Cursor API key is only used server-side and never exposed to the browser
- Don't commit your `.env` file (it's in `.gitignore`)
- When exposing the dashboard on a LAN, anyone with network access can view it
