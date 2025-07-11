# Claude Development Notes

## Project: Netlify Status Indicator for VS Code

### Overview
This project is a VS Code extension that displays real-time Netlify deployment status in the status bar.

### Development Commands
- `npm run compile` - Compile TypeScript
- `npm run test` - Run tests
- `npm run lint` - Run linting
- `npm run package` - Package extension for distribution

### Key Files
- `src/extension.ts` - Main extension entry point
- `package.json` - Extension manifest and dependencies
- `docs/PRD.md` - Product requirements document

### API Integration
- Uses Netlify REST API for deployment status
- Requires personal access token for authentication
- Implements rate limiting and error handling

### Extension Features
- Status bar indicator with color-coded status
- Click to open Netlify dashboard
- Configurable polling intervals
- Notification system for deployment events

### Notes
- Extension targets VS Code API version 1.60.0+
- Uses TypeScript for type safety
- Follows VS Code extension best practices
- Implements secure token storage using VS Code secrets API
- Always use Context7 for documentation lookups when available