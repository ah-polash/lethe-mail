"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  CheckCircle,
  Eye,
  MousePointer,
  AlertTriangle,
  MessageSquareWarning,
  UserMinus,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface FailedEvent {
  id: string;
  email: string;
  eventType: string;
  metadata: string | null;
  createdAt: string;
}

interface UnsubCategoryRef {
  id: string;
  slug: string;
  name: string;
}

interface UnsubscribeEvent {
  id: string;
  email: string;
  createdAt: string;
  scope: "all" | "categories";
  categories: UnsubCategoryRef[];
}

interface UnsubscribeSummary {
  total: number;
  all: number;
  categories: number;
  perCategory: { slug: string; name: string; count: number }[];
}

interface CampaignData {
  id: string;
  name: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplaints: number;
  totalUnsubscribed: number;
  eventCounts: Record<string, number>;
  failedEvents: FailedEvent[];
  unsubscribeEvents?: UnsubscribeEvent[];
  unsubscribeSummary?: UnsubscribeSummary;
}

interface CampaignEvent {
  id: string;
  eventType: string;
  email: string;
  createdAt: string;
}

export default function CampaignReportPage() {
  const params = useParams();
  const campaignId = params.id as string;
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`);
        if (res.ok) {
          const data = await res.json();
          setCampaign(data.campaign);

          // Fetch events separately if available, or use eventCounts
          // The campaign endpoint includes eventCounts from the events
        } else {
          toast.error("Failed to load report");
        }
      } catch {
        toast.error("Failed to load report");
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading report...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Report not available</p>
        <Link href="/campaigns" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>Back to Campaigns</Link>
      </div>
    );
  }

  // Headline metrics are computed from distinct-recipient event counts in the
  // GET endpoint (see eventCounts comment there). The stored campaign counters
  // can be inflated on older campaigns (legacy double-counting from when both
  // internal trackers and SES SNS wrote events without dedup), so we trust
  // eventCounts for unique-recipient metrics. For "sent" we still take the
  // stored counter as the canonical sent count.
  const ec = campaign.eventCounts || {};
  const stats = {
    sent: campaign.totalSent || ec["sent"] || 0,
    delivered: ec["delivered"] || 0,
    opened: ec["opened"] || 0,
    clicked: ec["clicked"] || 0,
    bounced: ec["bounced"] || 0,
    complaints: ec["complained"] || 0,
    unsubscribed: ec["unsubscribed"] || 0,
  };

  const total = stats.sent || 1;
  const pct = (value: number) => ((value / total) * 100).toFixed(1);

  const failed = ec["failed"] || 0;

  const statCards = [
    { label: "Sent", value: stats.sent, icon: Send, color: "text-blue-500" },
    { label: "Delivered", value: stats.delivered, icon: CheckCircle, color: "text-green-500" },
    { label: "Opened", value: stats.opened, icon: Eye, color: "text-purple-500" },
    { label: "Clicked", value: stats.clicked, icon: MousePointer, color: "text-indigo-500" },
    { label: "Bounced", value: stats.bounced, icon: AlertTriangle, color: "text-orange-500" },
    ...(failed > 0 ? [{ label: "Failed", value: failed, icon: AlertTriangle, color: "text-red-500" }] : []),
    { label: "Complaints", value: stats.complaints, icon: MessageSquareWarning, color: "text-red-500" },
    { label: "Unsubscribed", value: stats.unsubscribed, icon: UserMinus, color: "text-gray-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/campaigns" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
            <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Campaign Report
          </h2>
          <p className="text-muted-foreground">{campaign.name}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4 text-center">
                <Icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                <p className="text-2xl font-bold">
                  {stat.value.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                {stat.label !== "Sent" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {pct(stat.value)}%
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Key Rates */}
      <Card>
        <CardHeader>
          <CardTitle>Performance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Delivery Rate</span>
              <span>{pct(stats.delivered)}%</span>
            </div>
            <Progress value={parseFloat(pct(stats.delivered))} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Open Rate</span>
              <span>{pct(stats.opened)}%</span>
            </div>
            <Progress value={parseFloat(pct(stats.opened))} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Click Rate</span>
              <span>{pct(stats.clicked)}%</span>
            </div>
            <Progress value={parseFloat(pct(stats.clicked))} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Bounce Rate</span>
              <span>{pct(stats.bounced)}%</span>
            </div>
            <Progress value={parseFloat(pct(stats.bounced))} />
          </div>
        </CardContent>
      </Card>

      {/* Event Counts Summary */}
      {campaign.eventCounts && Object.keys(campaign.eventCounts).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Event Breakdown</CardTitle>
            <CardDescription>Events recorded from SES notifications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(campaign.eventCounts).map(([type, count]) => (
                <div key={type} className="text-center p-3 rounded-lg bg-muted">
                  <p className="text-lg font-bold">{count}</p>
                  <Badge variant="secondary" className="mt-1">{type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unsubscription Activities Breakdown */}
      {campaign.unsubscribeSummary && campaign.unsubscribeSummary.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-muted-foreground" />
              Unsubscription Activities Breakdown
            </CardTitle>
            <CardDescription>
              What recipients chose on the preference page from this campaign.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-lg font-bold">{campaign.unsubscribeSummary.total}</p>
                <p className="text-xs text-muted-foreground mt-1">Total events</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-lg font-bold">{campaign.unsubscribeSummary.all}</p>
                <p className="text-xs text-muted-foreground mt-1">Unsubscribed from all</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted">
                <p className="text-lg font-bold">{campaign.unsubscribeSummary.categories}</p>
                <p className="text-xs text-muted-foreground mt-1">Category-only</p>
              </div>
            </div>

            {campaign.unsubscribeSummary.perCategory.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  By category
                </p>
                <div className="flex flex-wrap gap-2">
                  {campaign.unsubscribeSummary.perCategory.map((c) => (
                    <Badge
                      key={c.slug}
                      variant="secondary"
                      className="text-[11px] font-mono"
                      title={c.name}
                    >
                      {c.slug}
                      <span className="ml-1.5 text-muted-foreground">×{c.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {campaign.unsubscribeEvents && campaign.unsubscribeEvents.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recent activity
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Unsubscribed From</TableHead>
                      <TableHead className="whitespace-nowrap">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaign.unsubscribeEvents.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="font-mono text-sm">{ev.email}</TableCell>
                        <TableCell>
                          {ev.scope === "all" ? (
                            <Badge variant="destructive" className="text-[10px]">
                              All emails
                            </Badge>
                          ) : ev.categories.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {ev.categories.map((c) => (
                                <Badge
                                  key={c.id}
                                  variant="secondary"
                                  className="text-[10px] font-mono"
                                  title={c.name}
                                >
                                  {c.slug}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(ev.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Failed / Bounced / Complained Log */}
      {campaign.failedEvents && campaign.failedEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Failed Delivery Log
            </CardTitle>
            <CardDescription>{campaign.failedEvents.length} issue{campaign.failedEvents.length > 1 ? "s" : ""} found</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaign.failedEvents.map((event) => {
                  let reason = "Unknown";
                  try {
                    const meta = JSON.parse(event.metadata || "{}");
                    if (meta.error) {
                      reason = meta.error;
                    } else if (meta.bounceType) {
                      reason = `${meta.bounceType}${meta.bounceSubType ? ` — ${meta.bounceSubType}` : ""}`;
                    } else if (meta.complaintFeedbackType) {
                      reason = meta.complaintFeedbackType;
                    }
                  } catch { /* ignore */ }

                  const badgeColor = event.eventType === "failed"
                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                    : event.eventType === "bounced"
                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";

                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-mono text-sm">{event.email}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
                          {event.eventType}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={reason}>{reason}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
