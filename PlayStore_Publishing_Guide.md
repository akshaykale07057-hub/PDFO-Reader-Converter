# Google Play Store Publishing Guide for PDFO Reader

This guide details the step-by-step process of building, signing, and uploading your Capacitor-wrapped React application to the Google Play Store.

---

## Prerequisites

Before starting, ensure you have:
1. **Android Studio** installed (includes Android SDK and build tools).
2. **Java Development Kit (JDK)** (JDK 17 is recommended for modern Gradle versions).
3. A **Google Play Console** developer account ($25 one-time registration fee).

---

## Step 1: Sync and Build Web Assets

Whenever you make changes to the React source code under `src/`, you must build the web assets and copy them into the native Android folder:

1. **Build the production bundle**:
   ```bash
   npm run build
   ```

2. **Sync the assets to the Android platform**:
   ```bash
   npx cap sync android
   ```

---

## Step 2: Generate a Release Keystore

To publish your application to the Google Play Store, it must be signed with a digital certificate (Keystore). If you do not have one, you can generate a new one using the Java `keytool` command:

Run the following command in your terminal (replace `my-release-key.keystore` and `my-key-alias` with your preferred filenames/names):

```bash
keytool -genkey -v -keystore android/app/release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000
```

*Note:*
- When prompted, set a secure password for the keystore and the key.
- Save this keystore file securely! If you lose it, you will not be able to upload updates to the Play Store.

---

## Step 3: Configure Signing Credentials

We have set up the project to read signing configuration dynamically. You have two options to configure signing:

### Option A: Use the `release-signing.properties` File (Recommended)
1. Copy `android/release-signing.properties.example` to `android/release-signing.properties`.
2. Fill in your credentials:
   ```properties
   storeFile=release.keystore
   storePassword=your_keystore_password
   keyAlias=release
   keyPassword=your_key_password
   ```
   *(This properties file is already ignored in git to prevent credential leaks).*

### Option B: Use Environment Variables (Ideal for CI/CD)
Set the following environment variables in your command line or build server:
- `ANDROID_KEYSTORE_PATH` (e.g. `C:\projects\pdfo-reader\android\app\release.keystore`)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

---

## Step 4: Generating and Customizing App Icons (Adaptive Icons)

Google Play requires **Adaptive Icons** to support various device shapes (circle, square, squircle, etc.).

We recommend using the `@capacitor/assets` tool to automatically generate all icons and splash screens.

1. **Install `@capacitor/assets`**:
   ```bash
   npm install @capacitor/assets --save-dev
   ```

2. **Create your source files**:
   Place a high-resolution icon (`icon-only.png` or `icon.png`, min 1024x1024px) and a splash screen (`splash.png`, min 2732x2732px) in an `assets/` folder in the project root.

3. **Run the generator**:
   ```bash
   npx capacitor-assets generate --android
   ```
   This will automatically resize and copy all icons to the respective folder configurations inside `android/app/src/main/res/`.

---

## Step 5: Build the Production Android App Bundle (AAB)

Google Play requires applications to be submitted in the **Android App Bundle (.aab)** format instead of APK.

To compile the release bundle:
1. Navigate into the `android/` directory:
   ```bash
   cd android
   ```
2. Execute the Gradle wrapper:
   - **Windows (Command Prompt / PowerShell)**:
     ```powershell
     ./gradlew bundleRelease
     ```
   - **macOS / Linux**:
     ```bash
     ./gradlew bundleRelease
     ```

Once compilation completes, your signed production app bundle will be located at:
`android/app/build/outputs/bundle/release/app-release.aab`

---

## Step 6: Uploading to Google Play Console

1. Log in to the [Google Play Console](https://play.google.com/console).
2. Click **Create app** and fill in your app details (Name, Default Language, App/Game, Free/Paid).
3. **Configure Store Presence**:
   - Provide a Short Description, Full Description, screenshots (phone, 7-inch tablet, 10-inch tablet), and high-res icon.
4. **App Content Questionnaire**:
   - Complete required declarations (Privacy Policy, Ads, Content Rating, Target Audience, etc.).
5. **Create a Release**:
   - Navigate to **Release** > **Production** (or **Closed Testing** to test first).
   - Click **Create new release**.
   - Upload the `.aab` file from `android/app/build/outputs/bundle/release/app-release.aab`.
   - Submit for review!
