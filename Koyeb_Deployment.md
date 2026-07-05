# Deploying to Koyeb and Play Store Publishing Guide

This guide describes how to deploy your document reader and conversion application to Koyeb using the configured `Dockerfile` and hook it up to your Android app for publishing on the Google Play Store.

---

## Part 1: Deploying to Koyeb

Koyeb is a serverless hosting platform that supports deploying applications directly from Dockerfiles.

### Step 1: Push Code to GitHub
Ensure all your files, including the new `Dockerfile` and `.dockerignore`, are pushed to a repository on GitHub.

### Step 2: Create a Koyeb Account
If you haven't already, sign up at [Koyeb.com](https://www.koyeb.com/).

### Step 3: Create a New Web Service
1. In the Koyeb Console, click **Create Service**.
2. Select **GitHub** as the deployment method.
3. Choose your repository and the branch you want to deploy (e.g. `main` or `master`).
4. In the **Builder** section, select **Dockerfile** (Koyeb will automatically detect the `Dockerfile` in the root).

### Step 4: Configure Port and Environment Variables
1. Under **Ports**, define the port:
   - Port: `8080` (This matches the `EXPOSE 8080` inside the Dockerfile).
   - Protocol: `HTTP`
   - Path: `/`
2. Under **Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `PORT` = `8080`
3. Click **Deploy**.

Koyeb will build the container, install Node.js, install LibreOffice, build the Vite React app, and launch the server. Once completed, Koyeb will give you a public URL (e.g., `https://<your-app-slug>.koyeb.app`).

---

## Part 2: Play Store Publishing Configuration

Once your web application is live on Koyeb, you need to point your Android WebView wrapper to this live URL before compiling and signing the APK/AAB for Play Store submission.

### Scenario A: If Using a Capacitor / Cordova Wrapper
If you are wrapping your React web app using Capacitor to compile it natively:
1. Open your native Android project configuration in Android Studio.
2. In `capacitor.config.json` (or your project's configuration file), configure the server URL if you want it to load from your hosted Koyeb website directly instead of local assets:
   ```json
   {
     "appId": "com.yourdomain.pdfreader",
     "appName": "PDF Reader Pro",
     "webDir": "dist",
     "server": {
       "url": "https://<your-app-slug>.koyeb.app",
       "cleartext": true
     }
   }
   ```
   *Note: Loading from the hosted URL allows you to update the web app instantly without forcing users to update the Android app through the Play Store.*

### Scenario B: If Using a Custom Native Android WebView
If you have a native Android app with a `WebView` (Kotlin/Java):
1. Locate your main activity file (e.g. `MainActivity.kt` or `MainActivity.java`).
2. Update the `webView.loadUrl(...)` target:
   ```kotlin
   // Kotlin example
   val myWebView: WebView = findViewById(R.id.webview)
   myWebView.settings.javaScriptEnabled = true
   myWebView.settings.domStorageEnabled = true // Required for client-side IndexedDB persistence
   myWebView.loadUrl("https://<your-app-slug>.koyeb.app")
   ```
3. Set up the JavaScript interfaces. Since the web app uses `window.AndroidInterface.shareText` (lines 145-148 of `App.tsx`), make sure your Android app exposes this interface:
   ```kotlin
   class WebAppInterface(private val mContext: Context) {
       @JavascriptInterface
       fun shareText(text: String) {
           val sendIntent = Intent().apply {
               action = Intent.ACTION_SEND
               putExtra(Intent.EXTRA_TEXT, text)
               type = "text/plain"
           }
           mContext.startActivity(Intent.createChooser(sendIntent, "Share via"))
       }
   }
   // Bind interface inside MainActivity
   webView.addJavascriptInterface(WebAppInterface(this), "AndroidInterface")
   ```

---

## Part 3: Troubleshooting and Performance

### 1. File Upload Size Limits
The Express server has an upload size limit of **50 MB** configured in `server/config.js` via Multer. Ensure your Koyeb instance class has enough RAM to convert large files. The Free instance of Koyeb comes with **512 MB of RAM**. If LibreOffice throws an out-of-memory error when processing huge files, consider upgrading your Koyeb instance tier.

### 2. Native C++ Modules Build Errors
If you see errors relating to `better-sqlite3` compiling during the Koyeb Docker build:
1. Since the app relies on IndexedDB (`idb-keyval`) for local storage, `better-sqlite3` is not utilized.
2. You can safely remove it by running the following command locally and committing the change:
   ```bash
   npm uninstall better-sqlite3
   ```
