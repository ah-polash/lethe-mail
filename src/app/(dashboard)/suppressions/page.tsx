"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Loader2,
  Download,
  Mail,
  AlertTriangle,
  Ban,
  Trash2,
  FlaskConical,
  Send,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface SuppressionRow {
  email: string;
  name: string | null;
  reasons: string[];
  sources: string[];
  swipeOneTags: string[];
  contactId: string | null;
  isMarketingAllowed: boolean | null;
  firstSuppressedAt: string;
  lastSuppressedAt: string;
  eventCount: number;
  campaignIds: string[];
}

interface ApiResponse {
  suppressions: SuppressionRow[];
  total: number;
  counts: {
    unsubscribed: number;
    complained: number;
    bounced: number;
  };
}

const reasonStyles: Record<string, string> = {
  unsubscribed:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  complained:
    "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200",
  bounced:
    "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300",
};

export default function SuppressionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<"all" | "unsubscribed" | "complained" | "bounced">("all");
  const [resetting, setResetting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Dev tools: SES simulator
  type SesIdentity = { identity: string; type: string; verified: boolean };
  const [identities, setIdentities] = useState<SesIdentity[]>([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(false);
  const [simulatorFrom, setSimulatorFrom] = useState("");
  const [simulatorFromName, setSimulatorFromName] = useState("");
  const [simulatorPending, setSimulatorPending] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user?.role !== "super_admin") {
          router.push("/dashboard");
          return;
        }
        setAuthChecked(true);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (reasonFilter !== "all") params.set("reason", reasonFilter);
      const res = await fetch(`/api/suppressions?${params}`);
      if (res.ok) {
        const json = (await res.json()) as ApiResponse;
        setData(json);
      } else {
        toast.error("Failed to load suppressions");
      }
    } catch {
      toast.error("Failed to load suppressions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authChecked) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, reasonFilter]);

  useEffect(() => {
    if (!authChecked) return;
    setIdentitiesLoading(true);
    fetch("/api/ses/identities")
      .then((r) => r.json())
      .then((d) => {
        const verified = (d.identities || []).filter(
          (i: SesIdentity) => i.verified && i.type === "EMAIL_ADDRESS"
        );
        setIdentities(verified);
        if (verified.length === 1) setSimulatorFrom(verified[0].identity);
      })
      .catch(() => {})
      .finally(() => setIdentitiesLoading(false));
  }, [authChecked]);

  const SIMULATORS: Array<{
    key: "success" | "bounce" | "ooto" | "complaint" | "suppressionlist" | "reject";
    label: string;
    description: string;
    target: string;
    variant: "default" | "outline" | "destructive" | "secondary";
  }> = [
    {
      key: "success",
      label: "Success (Delivery)",
      description: "Generates a Delivery event.",
      target: "success@simulator.amazonses.com",
      variant: "default",
    },
    {
      key: "bounce",
      label: "Hard Bounce",
      description: "Permanent bounce. Triggers suppression.",
      target: "bounce@simulator.amazonses.com",
      variant: "destructive",
    },
    {
      key: "ooto",
      label: "Soft Bounce (OOTO)",
      description: "Transient out-of-office bounce.",
      target: "ooto@simulator.amazonses.com",
      variant: "secondary",
    },
    {
      key: "complaint",
      label: "Complaint",
      description: "Spam report. Triggers suppression.",
      target: "complaint@simulator.amazonses.com",
      variant: "destructive",
    },
    {
      key: "suppressionlist",
      label: "Suppression-list bounce",
      description: "Bounces because address is on SES account suppression list.",
      target: "suppressionlist@simulator.amazonses.com",
      variant: "outline",
    },
    {
      key: "reject",
      label: "Reject (virus)",
      description: "Pre-send rejection — no delivery attempt.",
      target: "reject@simulator.amazonses.com",
      variant: "outline",
    },
  ];

  const fireSimulator = async (key: typeof SIMULATORS[number]["key"]) => {
    if (!simulatorFrom) {
      toast.error("Choose a verified sender first");
      return;
    }
    setSimulatorPending(key);
    try {
      const res = await fetch("/api/dev/ses-simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simulator: key,
          fromEmail: simulatorFrom,
          fromName: simulatorFromName || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Sent ${json.label}. messageId: ${json.messageId || "(none)"}`);
      } else {
        toast.error(json.error || "Simulator send failed");
      }
    } catch {
      toast.error("Simulator send failed");
    } finally {
      setSimulatorPending(null);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/suppressions", { method: "DELETE" });
      if (res.ok) {
        const json = await res.json();
        toast.success(
          `Suppression list cleared (${json.eventsDeleted} event(s), ${json.contactsCleared} contact(s) re-enabled)`
        );
        setResetOpen(false);
        await load();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to reset suppression list");
      }
    } catch {
      toast.error("Failed to reset suppression list");
    } finally {
      setResetting(false);
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.suppressions;
    return data.suppressions.filter(
      (s) => s.email.toLowerCase().includes(q) || (s.name || "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const exportCsv = () => {
    if (!data) return;
    const rows = filtered;
    if (rows.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const header = [
      "email",
      "full_name",
      "reasons",
      "sources",
      "swipeone_tags_added",
      "first_suppressed_at",
      "last_suppressed_at",
      "event_count",
    ];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.email,
          r.name || "",
          r.reasons.join("|"),
          r.sources.join("|"),
          (r.swipeOneTags || []).join("|"),
          r.firstSuppressedAt,
          r.lastSuppressedAt,
          r.eventCount,
        ]
          .map(esc)
          .join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suppression-list-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} row(s)`);
  };

  if (!authChecked) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ShieldAlert className="h-7 w-7 text-amber-500" />
              Suppression List
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Recipients who unsubscribed, complained, or hard-bounced. These addresses are
              automatically excluded from sends — required for AWS SES compliance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1.5" />
              )}
              Refresh
            </Button>
            <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={resetting || !data || data.total === 0}
                    title="Dev/test only — wipes the entire suppression list"
                  >
                    {resetting ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1.5" />
                    )}
                    Reset List
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset the suppression list?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will <span className="font-semibold">permanently delete</span> every
                    unsubscribe / complaint / hard-bounce event, re-enable marketing on every
                    locally suppressed contact, and zero out the per-campaign suppression
                    counters. SwipeOne tags are <span className="font-semibold">not</span>{" "}
                    removed. Use only on development or test environments.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReset}
                    disabled={resetting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {resetting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset list"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data || filtered.length === 0}>
              <Download className="h-4 w-4 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
              </div>
              <p className="text-2xl font-semibold mt-1">{data?.total ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Ban className="h-4 w-4 text-amber-500" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Unsubscribed</p>
              </div>
              <p className="text-2xl font-semibold mt-1">{data?.counts.unsubscribed ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Complained</p>
              </div>
              <p className="text-2xl font-semibold mt-1">{data?.counts.complained ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-zinc-500" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Hard-Bounced</p>
              </div>
              <p className="text-2xl font-semibold mt-1">{data?.counts.bounced ?? 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* Dev tools: SES simulator */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">SES Mailbox Simulator</h3>
              <Badge variant="outline" className="text-[10px]">
                Dev / Test
              </Badge>
              <span className="text-xs text-muted-foreground ml-auto">
                Fires a real send to an SES simulator address — sandbox limits don&apos;t apply.
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From (verified identity)</Label>
                {identitiesLoading ? (
                  <div className="flex items-center text-xs text-muted-foreground h-9">
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Loading verified senders...
                  </div>
                ) : identities.length === 0 ? (
                  <p className="text-xs text-muted-foreground h-9 flex items-center">
                    No verified email identities. Configure SES first.
                  </p>
                ) : (
                  <Select value={simulatorFrom} onValueChange={(v) => v && setSimulatorFrom(v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Choose a sender" />
                    </SelectTrigger>
                    <SelectContent>
                      {identities.map((id) => (
                        <SelectItem key={id.identity} value={id.identity}>
                          {id.identity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From Name (optional)</Label>
                <Input
                  placeholder="e.g. Lethe Mail Test"
                  value={simulatorFromName}
                  onChange={(e) => setSimulatorFromName(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {SIMULATORS.map((s) => (
                <div key={s.key} className="border rounded-md p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold">{s.label}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{s.description}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate" title={s.target}>
                    {s.target}
                  </p>
                  <Button
                    variant={s.variant}
                    size="sm"
                    className="h-7 text-xs mt-1"
                    onClick={() => fireSimulator(s.key)}
                    disabled={simulatorPending === s.key || !simulatorFrom}
                  >
                    {simulatorPending === s.key ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-3 w-3 mr-1.5" />
                        Fire {s.key}
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              SES posts the resulting event to your configured SNS topic, which calls{" "}
              <code className="font-mono">/api/webhooks/ses</code>. For local testing, expose
              the dev server with ngrok and subscribe SNS to the tunnel URL.
            </p>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-[400px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by email or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8"
            />
          </div>
          <Select value={reasonFilter} onValueChange={(v) => v && setReasonFilter(v as typeof reasonFilter)}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reasons</SelectItem>
              <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
              <SelectItem value="complained">Complained</SelectItem>
              <SelectItem value="bounced">Hard-bounced</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} of {data?.total ?? 0} record{(data?.total ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table */}
        {loading && !data ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading suppression list...
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                {data?.total === 0
                  ? "No suppressions yet. Recipients are added here automatically when they unsubscribe, complain, or hard-bounce."
                  : "No suppressions match your filters."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Added Tag</TableHead>
                  <TableHead className="text-right">Events</TableHead>
                  <TableHead>Last suppressed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.email}>
                    <TableCell className="font-medium">{s.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.name || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.reasons.map((r) => (
                          <Badge
                            key={r}
                            variant="outline"
                            className={`text-[10px] capitalize ${reasonStyles[r] || ""}`}
                          >
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.sources.map((src) => (
                          <Badge
                            key={src}
                            variant="secondary"
                            className="text-[10px] capitalize"
                          >
                            {src}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.swipeOneTags && s.swipeOneTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.swipeOneTags.map((tag) => (
                            <Badge
                              key={tag}
                              variant="outline"
                              className="text-[10px] font-mono border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                      {s.eventCount}
                    </TableCell>
                    <TableCell className="text-sm">
                      <Tooltip>
                        <TooltipTrigger render={<span>{new Date(s.lastSuppressedAt).toLocaleDateString()}</span>} />
                        <TooltipContent>
                          {new Date(s.lastSuppressedAt).toLocaleString()}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
