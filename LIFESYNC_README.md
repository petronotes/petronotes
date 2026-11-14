# LifeSync Android — isolated build branch

This branch contains a sanitized LifeSync Android prototype, separate from the repository's main branch.

## Get the APK
Open **Actions → Build LifeSync APK**, open the successful run and download the artifact **LifeSync-debug-apk**. It contains `app-debug.apk`.

## Sources
The source project is stored as a deterministic gzip/tar archive split into six base64 text files in `lifesync-src/`. The workflow concatenates and verifies them, then extracts the Kotlin/Gradle app and its Google Apps Script integration. This avoids uploading the user's personal spreadsheet ID or any access token to this public GitHub repository.

## Privacy
Before deploying the Apps Script, replace `PASTE_YOUR_GOOGLE_SHEET_ID_HERE` in `apps_script/Code.gs` with your own spreadsheet ID. Never commit the token. The application requires Android usage access and explicit Health Connect permissions. It will not access private data before the user grants them.

## Status
Prototype 0.1.0; automatic build does not imply verification on a real Samsung phone.