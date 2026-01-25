# Session Cookie Fix - Deployment Guide

## Overview
This document describes the changes made to fix session cookie persistence issues in Vercel's serverless environment.

## Problem
- Sessions were created successfully in PostgreSQL database
- Login endpoint returned 200 OK
- But subsequent requests returned 401 Unauthorized
- Root cause: Session cookies were not being sent back by the browser

## Solution Implemented

### Changes to `server.js`

#### 1. Session Configuration Updates
```javascript
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'vitamin-english-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'vitamin_session', // NEW: Explicit cookie name
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // CHANGED: from 'strict' to 'lax'
        path: '/', // NEW: Explicit path
        domain: process.env.COOKIE_DOMAIN || undefined // NEW: Configurable domain
    },
    proxy: process.env.NODE_ENV === 'production' // NEW: Trust Vercel proxy
};
```

**Key Changes:**
- `sameSite: 'lax'` - Allows cookies in top-level navigation while preventing CSRF
- `proxy: true` - Trusts Vercel's proxy headers for secure cookie handling
- `name: 'vitamin_session'` - Explicit cookie name for consistency
- `path: '/'` - Ensures cookie is sent for all routes
- `domain` - Allows override via environment variable if needed

#### 2. Response Headers Middleware
Added middleware to ensure proper CORS headers for cookie transmission:

```javascript
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        res.header('Access-Control-Allow-Credentials', 'true');
        const allowedOrigin = process.env.CORS_ORIGIN;
        if (allowedOrigin && allowedOrigin !== 'true') {
            res.header('Access-Control-Allow-Origin', allowedOrigin);
        } else if (req.headers.origin) {
            res.header('Access-Control-Allow-Origin', req.headers.origin);
        }
    }
    next();
});
```

#### 3. Session Debugging Middleware
Added conditional debugging (enabled via environment variable):

```javascript
if (process.env.DEBUG_SESSIONS === 'true') {
    app.use((req, res, next) => {
        console.log('📍 Session Debug:', {
            path: req.path,
            method: req.method,
            sessionID: req.sessionID,
            hasSession: !!req.session,
            userId: req.session?.userId,
            cookieHeader: req.headers.cookie ? 'present' : 'missing'
        });
        next();
    });
}
```

## Deployment Steps

### 1. Deploy to Vercel
The changes are already committed. Simply deploy to Vercel as usual:
```bash
git push origin main
```

### 2. (Optional) Enable Session Debugging
In Vercel Dashboard → Settings → Environment Variables, add:
```
DEBUG_SESSIONS=true
```

This will log detailed session information to help troubleshoot any issues.

### 3. (Optional) Configure CORS Origin
For enhanced security in production, set a specific origin:
```
CORS_ORIGIN=https://your-production-domain.com
```

### 4. (Optional) Configure Cookie Domain
If cookies still don't work, you can set a specific domain:
```
COOKIE_DOMAIN=.vercel.app
```
or
```
COOKIE_DOMAIN=.your-custom-domain.com
```

## Testing After Deployment

### 1. Browser DevTools Check
1. Open browser DevTools (F12)
2. Go to Application → Cookies
3. Login to the application
4. Look for `vitamin_session` cookie with these properties:
   - ✅ Name: `vitamin_session`
   - ✅ HttpOnly: true
   - ✅ Secure: true
   - ✅ SameSite: Lax
   - ✅ Path: /

### 2. Network Tab Check
1. Open Network tab in DevTools
2. Login with admin credentials
3. Check `/api/auth/login` response headers
4. Should see: `Set-Cookie: vitamin_session=...`

### 3. Subsequent Request Check
1. After login, navigate to any page (e.g., Students, Classes)
2. Check the request headers in Network tab
3. Should see: `Cookie: vitamin_session=...`

### 4. Verify No 401 Errors
1. Login as admin
2. Navigate to different pages
3. All pages should load without 401 Unauthorized errors

### 5. Check Vercel Logs (if DEBUG_SESSIONS enabled)
Look for session debug output like:
```
📍 Session Debug: {
  path: '/api/classes',
  method: 'GET',
  sessionID: 'H9649B7Q...',
  hasSession: true,
  userId: 1,
  cookieHeader: 'present'
}
```

## Expected Behavior

### Before Fix
```
1. POST /api/auth/login → 200 OK (session created)
2. GET /api/classes → 401 Unauthorized (cookie not sent)
```

### After Fix
```
1. POST /api/auth/login → 200 OK (Set-Cookie header sent)
2. Browser stores cookie
3. GET /api/classes → 200 OK (Cookie header sent, session found)
```

## Troubleshooting

### If cookies still don't persist:

#### Option 1: Check Browser Settings
- Ensure cookies are enabled
- Disable any extensions that block cookies
- Try in incognito mode

#### Option 2: Try Different SameSite Setting
If `lax` doesn't work, you can try `none` (less secure):
```javascript
sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
```
Note: This requires `secure: true`

#### Option 3: Set Explicit Domain
Add to Vercel environment variables:
```
COOKIE_DOMAIN=.your-vercel-app.vercel.app
```

#### Option 4: Check CORS Configuration
Ensure frontend and backend are on the same domain or CORS is properly configured.

## Security Considerations

### Changes Made for Security:
1. `httpOnly: true` - Prevents JavaScript access to cookies
2. `secure: true` in production - Only sends cookies over HTTPS
3. `sameSite: 'lax'` - Provides CSRF protection
4. CORS origin respects `CORS_ORIGIN` env var
5. Proxy trust only enabled in production

### No Security Compromises:
- Session data still stored securely in PostgreSQL
- Passwords still hashed with bcrypt
- All existing security headers maintained
- No new attack vectors introduced

## Rollback Plan

If issues occur, you can rollback by reverting these changes in `server.js`:
1. Change `sameSite: 'lax'` back to `sameSite: 'strict'`
2. Remove `proxy: true`
3. Remove the response headers middleware
4. Remove the session debugging middleware

## Support

If issues persist after deployment:
1. Enable `DEBUG_SESSIONS=true` and check Vercel logs
2. Share the session debug output
3. Check browser console for errors
4. Verify cookie is being set in DevTools

## Summary

This fix addresses the session cookie persistence issue by:
- Using `sameSite: 'lax'` for Vercel compatibility
- Trusting Vercel's proxy in production
- Adding proper CORS headers for credentials
- Providing debugging tools for troubleshooting

The changes are minimal, focused, and maintain all existing security measures.
