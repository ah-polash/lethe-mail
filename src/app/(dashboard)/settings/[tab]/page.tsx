import { notFound } from "next/navigation";
import { SettingsView } from "../settings-view";
import { SETTINGS_TABS } from "../tabs";

// /settings/<tab> — the same screen with that tab selected, so each tab is
// linkable, bookmarkable and survives a refresh.
export default async function SettingsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  if (!(SETTINGS_TABS as readonly string[]).includes(tab)) notFound();
  return <SettingsView />;
}
