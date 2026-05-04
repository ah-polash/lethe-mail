"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Eye, Pencil, ScrollText, Loader2, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  totalRecipients: number;
  totalSent: number;
  totalOpened: number;
  createdAt: string;
}

const statusVariant: Record<string, "secondary" | "outline" | "default" | "destructive"> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "outline",
  sent: "default",
  failed: "destructive",
};

const statusColors: Record<string, string> = {
  scheduled: "border-blue-500 text-blue-600 dark:text-blue-400",
  sending: "border-yellow-500 text-yellow-600 dark:text-yellow-400",
  sent: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

interface LogEvent {
  id: string;
  campaignId: string;
  email: string;
  eventType: string;
  metadata: string | null;
  createdAt: string;
}

interface WebhookLog {
  id: string;
  source: string;
  type: string | null;
  eventType: string | null;
  messageId: string | null;
  email: string | null;
  campaignId: string | null;
  status: string;
  result: string | null;
  raw: string;
  createdAt: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Campaign log dialog
  const [logCampaign, setLogCampaign] = useState<Campaign | null>(null);
  const [logEvents, setLogEvents] = useState<LogEvent[]>([]);
  const [logHooks, setLogHooks] = useState<WebhookLog[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logTab, setLogTab] = useState<"events" | "hooks">("events");

  const loadLog = async (campaign: Campaign) => {
    setLogLoading(true);
    try {
      const [evRes, hookRes] = await Promise.all([
        fetch(`/api/campaign-events?campaignId=${encodeURIComponent(campaign.id)}`),
        fetch(`/api/webhook-logs?campaignId=${encodeURIComponent(campaign.id)}&includeUnmatched=1`),
      ]);
      if (evRes.ok) {
        const json = await evRes.json();
        setLogEvents(json.events || []);
      } else {
        setLogEvents([]);
      }
      if (hookRes.ok) {
        const json = await hookRes.json();
        setLogHooks(json.logs || []);
      } else {
        setLogHooks([]);
      }
    } catch {
      toast.error("Failed to load campaign log");
    } finally {
      setLogLoading(false);
    }
  };

  const openLog = (campaign: Campaign) => {
    setLogCampaign(campaign);
    setLogEvents([]);
    setLogHooks([]);
    setLogTab("events");
    loadLog(campaign);
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch {
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Campaign deleted");
        setCampaigns((prev) => prev.filter((c) => c.id !== id));
      } else {
        toast.error("Failed to delete campaign");
      }
    } catch {
      toast.error("Failed to delete campaign");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Campaigns</h2>
          <p className="text-muted-foreground">
            Manage your email campaigns
          </p>
        </div>
        <Link href="/campaigns/new" className={cn(buttonVariants())}>
            <Plus className="mr-2 h-4 w-4" />
            New Campaign
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              Loading campaigns...
            </p>
          ) : campaigns.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-sm mb-4">
                No campaigns yet
              </p>
              <Link href="/campaigns/new" className={cn(buttonVariants())}>Create your first campaign</Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Sent</TableHead>
                  <TableHead className="text-right">Opens</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">
                      {campaign.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant[campaign.status] || "secondary"}
                        className={statusColors[campaign.status] || ""}
                      >
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(campaign.totalRecipients || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(campaign.totalSent || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {(campaign.totalOpened || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openLog(campaign)}
                          title="View campaign log (events + raw SNS payloads) — dev/test"
                        >
                          <ScrollText className="h-4 w-4 text-amber-600" />
                        </Button>
                        {campaign.status === "sent" && (
                          <Link href={`/campaigns/${campaign.id}/report`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                              <Eye className="h-4 w-4" />
                          </Link>
                        )}
                        {campaign.status === "draft" && (
                          <>
                            <Link href={`/campaigns/${campaign.id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                                <Pencil className="h-4 w-4" />
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger render={<Button variant="ghost" size="icon" />}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Campaign
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete &quot;{campaign.name}&quot;? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(campaign.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {campaign.status !== "draft" &&
                          campaign.status !== "sent" && (
                            <Link href={`/campaigns/${campaign.id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                                <Eye className="h-4 w-4" />
                            </Link>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Campaign log dialog (dev/test) */}
      <Dialog
        open={logCampaign !== null}
        onOpenChange={(open) => {
          if (!open) {
            setLogCampaign(null);
            setLogEvents([]);
            setLogHooks([]);
          }
        }}
      >
        <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-[90vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-amber-500" />
              Campaign Log
              <Badge variant="outline" className="text-[10px] ml-1">Dev / Test</Badge>
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium">{logCampaign?.name}</span> — every event recorded
              for this campaign, including raw SNS webhook payloads. Use this to verify
              AWS is delivering bounce/complaint/delivery events to{" "}
              <code className="font-mono">/api/webhooks/ses</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 border-b">
            <button
              type="button"
              onClick={() => setLogTab("events")}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                logTab === "events"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              Events ({logEvents.length})
            </button>
            <button
              type="button"
              onClick={() => setLogTab("hooks")}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                logTab === "hooks"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              SNS Webhook payloads ({logHooks.length})
            </button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs ml-auto"
              onClick={() => logCampaign && loadLog(logCampaign)}
              disabled={logLoading}
            >
              {logLoading ? (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1.5" />
              )}
              Refresh
            </Button>
          </div>

          {logLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading log...
            </div>
          ) : logTab === "events" ? (
            logEvents.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground text-sm">
                No events recorded for this campaign.
              </p>
            ) : (
              <div className="border max-h-[60vh] overflow-auto bg-muted/20">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold">When</th>
                      <th className="px-3 py-2 font-semibold">Event</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logEvents.map((ev) => {
                      let parsed: unknown = null;
                      try { parsed = ev.metadata ? JSON.parse(ev.metadata) : null; } catch { parsed = ev.metadata; }
                      const color =
                        ev.eventType === "complained" || ev.eventType === "bounced"
                          ? "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
                          : ev.eventType === "unsubscribed"
                          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                          : ev.eventType === "delivered"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300";
                      return (
                        <tr key={ev.id} className="border-t align-top">
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                            {new Date(ev.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={`text-[10px] capitalize ${color}`}>
                              {ev.eventType}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 max-w-[260px] truncate" title={ev.email}>
                            {ev.email}
                          </td>
                          <td className="px-3 py-2 max-w-[520px]">
                            <pre className="text-[10px] font-mono whitespace-pre-wrap break-words bg-background border rounded p-2">
                              {parsed && typeof parsed === "object"
                                ? JSON.stringify(parsed, null, 2)
                                : String(parsed ?? "")}
                            </pre>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            logHooks.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground text-sm">
                No SNS webhook payloads logged yet. If you sent the campaign and expected
                bounce/complaint events, AWS isn&apos;t reaching{" "}
                <code className="font-mono">/api/webhooks/ses</code> — verify the SES
                configuration set, SNS subscription status, and that Bounce/Complaint event
                types are ticked on the destination.
              </p>
            ) : (
              <div className="border max-h-[60vh] overflow-auto bg-muted/20">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold">When</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Event</th>
                      <th className="px-3 py-2 font-semibold">Email</th>
                      <th className="px-3 py-2 font-semibold">Result</th>
                      <th className="px-3 py-2 font-semibold">Raw payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logHooks.map((h) => {
                      let pretty = h.raw;
                      try { pretty = JSON.stringify(JSON.parse(h.raw), null, 2); } catch { /* keep as-is */ }
                      const statusColor =
                        h.status === "processed" || h.status === "confirmed"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
                          : h.status === "error"
                          ? "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
                          : h.status === "unmatched" || h.status === "unhandled"
                          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                          : "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300";
                      return (
                        <tr key={h.id} className="border-t align-top">
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                            {new Date(h.createdAt).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className={`text-[10px] capitalize ${statusColor}`}>
                              {h.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs">{h.eventType || "—"}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={h.email || ""}>
                            {h.email || "—"}
                          </td>
                          <td className="px-3 py-2 max-w-[260px] text-[11px] text-muted-foreground">
                            {h.result || "—"}
                          </td>
                          <td className="px-3 py-2 max-w-[480px]">
                            <pre className="text-[10px] font-mono whitespace-pre-wrap break-words bg-background border rounded p-2 max-h-[160px] overflow-auto">
                              {pretty}
                            </pre>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t">
            <span>
              Includes unmatched / orphan SNS payloads to help diagnose missing campaign
              correlation. Webhook log persists raw bodies — consider purging in production.
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
