/**
 * Shared by the native splash (app.config.js → expo-splash-screen) and the JS loading screen,
 * so the hand-off between them is pixel-identical. Keep in sync with app.config.js.
 */
export const LAUNCH_BACKGROUND = '#0284c7';
/** Logo size in dp — matches expo-splash-screen `imageWidth`. */
export const LAUNCH_LOGO_SIZE = 120;
/** Transparent RydAid mark (white pin + wrench, no tile behind it). */
export const LAUNCH_LOGO = require('../../assets/splash-icon.png');
