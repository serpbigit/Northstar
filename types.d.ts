/**
 * This file contains shared type definitions used across the project.
 * It is a declaration file, so it only contains type information and
 * does not produce any JavaScript output.
 */

declare namespace GoogleAppsScript {
  namespace Events {
    // The built-in ChatEvent is not comprehensive. This extends it.
    interface ChatEvent {
      message?: {
        text?: string;
        [key: string]: any;
      };
      [key: string]: any;
    }
  }
}

/**
 * Shared type for language preference.
 */
type Language = 'en' | 'he';

/**
 * The standard input for any "Specialist" function.
 */
interface SpecialistParams {
  text: string;
  [key: string]: any;
}

/**
 * The standard return structure for any "Specialist" function.
 */
interface SpecialistResult {
  ok: boolean;
  message: string;
  card?: any;
}

/**
 * Represents the data structure for a row in the 'PendingActions' sheet.
 */
interface PendingActionSchema {
  ActionID: string;
  Timestamp: Date | string;
  Status: 'PENDING' | 'COMPLETED' | 'DELETED';
  HandlerKey: string;
  UserID: string;
  SpaceName: string;
  ActionPayload: string; // A stringified JSON object
}