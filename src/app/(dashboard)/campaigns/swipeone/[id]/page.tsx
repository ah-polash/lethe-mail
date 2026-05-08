"use client";

import { use } from "react";
import { SwipeOneCampaignEditor } from "../new/page";

export default function SwipeOneCampaignEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SwipeOneCampaignEditor campaignId={id} />;
}
