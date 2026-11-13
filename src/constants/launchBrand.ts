/**
 * Shared by the native splash (app.config.js → expo-splash-screen) and the JS loading screen,
 * so the hand-off between them is pixel-identical. Keep in sync with app.config.js.
 */
export const LAUNCH_BACKGROUND = '#0284c7';
/** Logo size in dp — matches expo-splash-screen `imageWidth`. */
export const LAUNCH_LOGO_SIZE = 120;
/** Transparent RydAid mark (white pin + wrench, no tile behind it). */
export const LAUNCH_LOGO = require('../../assets/splash-icon.png');
/**
 * Minimum time the JS loading screen stays up, counted from when its logo first paints, so the
 * intro (logo settle, one ripple, "Getting things ready…") plays fully. Slower loads are unaffected.
 */
export const LAUNCH_MIN_DISPLAY_MS = 1500;
/** Fade from the loading screen into the app. */
export const LAUNCH_EXIT_MS = 450;
/** One ripple cycle — keep below LAUNCH_MIN_DISPLAY_MS so a full cycle is always seen. */
export const LAUNCH_RIPPLE_MS = 1400;
