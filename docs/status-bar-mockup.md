# VS Code Status Bar Mockup - Netlify Status Indicator

## Visual Representation

Here's how the Netlify status indicator would appear in VS Code's status bar:

### Different Status States

```
┌─────────────────────────────────────────────────────────────────────────┐
│ VS Code Status Bar                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ Go to Line  Spaces: 4  UTF-8  LF  TypeScript  🟢 my-site: deployed     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Success State**: `🟢 my-site: deployed`
- Green circle indicates successful deployment
- Shows site name and current status

```
┌─────────────────────────────────────────────────────────────────────────┐
│ VS Code Status Bar                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ Go to Line  Spaces: 4  UTF-8  LF  TypeScript  🟡 my-site: building     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Building State**: `🟡 my-site: building`
- Yellow circle indicates deployment in progress
- May include animated spinner or pulse effect

```
┌─────────────────────────────────────────────────────────────────────────┐
│ VS Code Status Bar                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ Go to Line  Spaces: 4  UTF-8  LF  TypeScript  🔴 my-site: failed       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Failed State**: `🔴 my-site: failed`
- Red circle indicates deployment failure
- Clicking opens build logs or error details

```
┌─────────────────────────────────────────────────────────────────────────┐
│ VS Code Status Bar                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ Go to Line  Spaces: 4  UTF-8  LF  TypeScript  ⚪ my-site: ready        │
└─────────────────────────────────────────────────────────────────────────┘
```

**Ready State**: `⚪ my-site: ready`
- White/gray circle indicates site is ready but no recent deployment activity

```
┌─────────────────────────────────────────────────────────────────────────┐
│ VS Code Status Bar                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ Go to Line  Spaces: 4  UTF-8  LF  TypeScript  ⚠️ Netlify: disconnected │
└─────────────────────────────────────────────────────────────────────────┘
```

**Disconnected State**: `⚠️ Netlify: disconnected`
- Warning icon indicates API connection issues
- Shows generic "Netlify" instead of site name

## Alternative Compact View

For users who prefer minimal status bar usage:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ VS Code Status Bar                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ Go to Line  Spaces: 4  UTF-8  LF  TypeScript  🟢 Netlify              │
└─────────────────────────────────────────────────────────────────────────┘
```

**Compact Mode**: `🟢 Netlify`
- Shows only status color and "Netlify" text
- Hover tooltip shows full site name and status details

## Hover Tooltip Details

When hovering over the status indicator:

```
┌─────────────────────────────────┐
│ Site: my-awesome-site           │
│ Status: Successfully deployed   │
│ Updated: 2 minutes ago          │
│ Branch: main                    │
│ Deploy ID: 507f1f77bcf86cd799    │
│                                 │
│ Click to open Netlify dashboard │
└─────────────────────────────────┘
```

## Icon-Only Option

For extremely minimal status bars:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ VS Code Status Bar                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ Go to Line  Spaces: 4  UTF-8  LF  TypeScript  🟢                      │
└─────────────────────────────────────────────────────────────────────────┘
```

**Icon-Only**: `🟢`
- Shows only the status color indicator
- Full details available on hover
- Most space-efficient option

## Color Coding Reference

- 🟢 **Green**: Successful deployment, site is live
- 🟡 **Yellow**: Building/deploying in progress  
- 🔴 **Red**: Deployment failed, needs attention
- ⚪ **Gray**: Ready/idle state, no recent activity
- ⚠️ **Warning**: Connection issues, authentication problems

## Position Options

The indicator can be positioned in different areas of the status bar:
- **Right side** (default): After language indicator
- **Left side**: Before Git branch indicator  
- **Custom position**: User-configurable placement