// Shared by the client view and the route segment. Kept out of the "use client"
// file because a server component importing a value from a client module gets a
// module reference, not the value itself.
export const SETTINGS_TABS = [
  "app",
  "ses",
  "swipeone",
  "ai",
  "r2",
  "freemius",
  "users",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];
