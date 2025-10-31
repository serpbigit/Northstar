// ========== Block#16 — Shortcuts ==========

// Custom shell aliases to speed up common development tasks.

/**
 * To save and commit all current changes with a standard "remarks" message.
 * This is useful for making quick, iterative saves.
 */
save "remarks"

/**
 * To bundle all project TypeScript files into a single `docs/bundled.dm` file.
 * This is used to provide complete context for AI assistance or code reviews.
 */
bundle

// ========== Block#17 — Environment Setup ==========

// Commands required for setting up the development environment, especially in cloud-based IDEs.

/**
 * To authenticate with Google Apps Script in an environment without a local web browser (like Google Cloud Shell).
 * This command will print a URL to the console. You must copy this URL, paste it into a browser on your local machine,
 * complete the authentication flow, and then copy the resulting code back into the terminal.
 */
clasp login --no-localhost