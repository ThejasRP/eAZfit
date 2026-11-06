# eAZfit

An Android nutrition and fitness tracking app focused on daily intake logging, personal goals, and AI-assisted coaching.

## Features

- Track calories, protein, carbs, fats, water, steps, and sleep
- Log meals manually or by voice input using native Android speech recognition
- Context-aware food parsing and macro calculation optimized for Indian cuisine and regional foods
- Review 7-day intake and macro trends
- View a daily coaching briefing powered by Gemini
- Store data locally on device storage for a lightweight personal tracker

## Tech stack

- React + Vite
- Tailwind CSS
- Recharts
- Lucide React
- Gemini API for nutrition analysis, phonetic voice correction, and coaching
- Native Android Speech Recognition via Capacitor (`@capacitor-community/speech-recognition`) with Web Speech API fallback for local development
- Capacitor Health for native Android health data sync

## Getting started

1. Install dependencies:
   npm install
2. Start the web development server:
   npm run dev -- --host 0.0.0.0
3. Open the local Vite URL in your browser.

## First-time setup

When the app opens for the first time, add:

- a Gemini API key for nutrition analysis and coaching

Then complete the onboarding flow to set your profile and daily goals.

> The app is designed for a personal fitness workflow and stores data in local device storage for quick, lightweight use.

## Scripts

- `npm run dev` — run the development server
- `npm run build` — create a production build
- `npm run lint` — run ESLint checks
- `npm run preview` — preview the production build locally

## Android Deployment

This app is designed specifically for Android. To build and run on an Android device:

1. Build the frontend assets:
   npm run build
2. Sync web assets and plugins to Android:
   npx cap sync
3. Open the Android project in Android Studio:
   npx cap open android
4. Connect an Android phone with USB Debugging enabled, then click Run (Play), or generate an APK via Build > Build Bundle(s) / APK(s) > Build APK(s).

## Notes

- The app is Android-only; iOS is not supported.
- The Gemini API key is saved in local storage for convenience.
- AI was used during app development for UI improvements, feature enhancements, documentation and bug detection.
- Voice input uses on-device native Android speech recognition configured for Indian English (`en-IN`), with Gemini automatically correcting phonetic approximations and local dish names.
- This is a client-side app; it does not require a backend or user accounts.

## Production build

npm run build

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
