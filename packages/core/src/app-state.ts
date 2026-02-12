import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { DATA_DIR } from "@multica/utils";

/**
 * Application state stored in ~/.super-multica/app-state.json
 */
export interface AppState {
  version?: number;
  onboarding?: {
    completed: boolean;
    completedAt?: string;
  };
}

const APP_STATE_PATH = join(DATA_DIR, "app-state.json");

/**
 * Manages application-level state persisted to the file system.
 * This is separate from credentials and agent profiles.
 */
export class AppStateManager {
  private path: string = APP_STATE_PATH;
  private state: AppState | null = null;
  private mtimeMs: number | null = null;

  /**
   * Load state from file, using cache if file hasn't changed.
   */
  private load(): AppState {
    let mtimeMs: number | null = null;

    if (existsSync(this.path)) {
      try {
        mtimeMs = statSync(this.path).mtimeMs;
      } catch {
        mtimeMs = null;
      }
    }

    // Return cached state if file hasn't changed
    if (this.state && this.mtimeMs === mtimeMs) {
      return this.state;
    }

    this.mtimeMs = mtimeMs;

    // File doesn't exist, return default state
    if (mtimeMs === null) {
      this.state = { version: 1 };
      return this.state;
    }

    // Read and parse file
    try {
      const raw = readFileSync(this.path, "utf8");
      this.state = JSON.parse(raw) as AppState;
    } catch {
      // If parse fails, return default state
      this.state = { version: 1 };
    }

    return this.state;
  }

  /**
   * Save state to file.
   */
  private save(state: AppState): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const content = JSON.stringify(state, null, 2);
    writeFileSync(this.path, content, "utf8");

    // Update cache
    this.state = state;
    try {
      this.mtimeMs = statSync(this.path).mtimeMs;
    } catch {
      this.mtimeMs = null;
    }
  }

  /**
   * Check if onboarding has been completed.
   */
  getOnboardingCompleted(): boolean {
    const state = this.load();
    return state.onboarding?.completed ?? false;
  }

  /**
   * Mark onboarding as completed.
   */
  setOnboardingCompleted(completed: boolean): void {
    const state = this.load();

    state.onboarding = {
      completed,
      completedAt: completed ? new Date().toISOString() : undefined,
    };

    this.save(state);
  }

  /**
   * Reset the manager's cache, forcing a reload on next access.
   */
  reset(): void {
    this.state = null;
    this.mtimeMs = null;
  }

  /**
   * Reset onboarding state (for development testing).
   * Sets completed to false and removes completedAt.
   */
  resetOnboarding(): void {
    const state = this.load();
    state.onboarding = {
      completed: false,
    };
    this.save(state);
  }
}

export const appStateManager = new AppStateManager();
