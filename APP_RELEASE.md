# Releasing Seynsei as an app (Android + iOS)

The frontend is wrapped with Capacitor: the exact same React build ships inside a native shell. The web app on Vercel keeps working unchanged.

## One-time setup (on your Mac)

```bash
cd frontend
npm install                      # pulls the new @capacitor/* packages
npm run build                    # produces dist/
npx cap add android
npx cap add ios
```

This creates `frontend/android/` and `frontend/ios/` native projects. Commit them.

Prerequisites: Android Studio (free) for Android; Xcode (free, from the App Store) for iOS. For store publishing you need a Google Play Console account ($25 one-off) and an Apple Developer account ($99/year).

## Everyday workflow

After any frontend change:

```bash
npm run cap:sync        # build web + copy into both native projects
npm run cap:android     # or: opens the project in Android Studio
npm run cap:ios         # opens the project in Xcode
```

Run on a device/emulator from Android Studio or Xcode as usual.

## App identity

- App ID: `uk.co.seyn.seynsei` (set in `frontend/capacitor.config.ts`) — must never change after first store upload, so confirm you're happy with it before publishing.
- The splash screen and status bar are configured in the same file to match the app's dark navy (#0e1820).

## Icons and splash screens

Generate all densities from your existing 1024px icon:

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#0e1820' --splashBackgroundColor '#0e1820'
```

Put `icon.png` (1024×1024) and optionally `splash.png` (2732×2732) in `frontend/assets/` first.

## Backend notes (already handled, just be aware)

- The app talks to `https://api-seynsei.seyn.co.uk/api` (from `.env.production`) — the native app uses the same production API.
- CORS: native requests come from `https://localhost` (iOS) / the `androidScheme` origin. Add `https://localhost` and `capacitor://localhost` to `CORS_ORIGINS` on Render before testing the native builds.
- Keep-warm: Render free tier sleeps; the existing GitHub Action pings it. Consider upgrading before promoting the app, or first-open will feel slow.

## Play Store (Android)

1. In Android Studio: Build → Generate Signed Bundle → create a keystore. **Back the keystore up somewhere safe — losing it means you can never update the app.**
2. Upload the `.aab` to Play Console → Internal testing first.
3. Store listing needs: 512px icon, feature graphic (1024×500), 2+ phone screenshots, privacy policy URL (required — the app collects email + wellbeing data).
4. Data safety form: declare collection of email (account) and health-related in-app data (anxiety ratings), encrypted in transit, deletable (you have DELETE /me — mention account deletion in the listing; Play requires a web deletion path or in-app deletion, which you already have).
5. Roll out to production after testing.

## App Store (iOS)

1. In Xcode: set your Team (Apple Developer account), bundle ID `uk.co.seyn.seynsei`.
2. Product → Archive → Distribute to App Store Connect.
3. TestFlight first, then submit for review.
4. Review notes: apps in the mental-wellbeing space pass review more smoothly if the listing avoids medical claims. Describe it as "confidence practice / CBT-informed exercises", not treatment or therapy. Include the privacy policy URL and a demo login for the reviewer.
5. App Privacy section: same declarations as Play (email, wellbeing data, no tracking).

## Suggested store copy (starting point)

> **Seynsei — quiet courage, daily.**
> Small, real-world confidence challenges, graded from a three-second moment of eye contact to the conversations you've been avoiding. Rate how you feel before and after, watch the numbers fall, and talk it through with Sensei — your calm, CBT-informed coach.

## Later (optional hardening)

- Move JWT storage from localStorage to `@capacitor/preferences` (or a secure-storage plugin) inside the native shell.
- Deep links (`https://seynsei.seyn.co.uk/...` opening the app) via Capacitor App plugin + `assetlinks.json` / Apple App Site Association.
