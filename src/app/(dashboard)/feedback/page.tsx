"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bug,
  Lightbulb,
  Plus,
  Loader2,
  ImagePlus,
  X,
  Trash2,
  Copy,
  CircleDot,
  MessageSquareWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FeedbackReport {
  id: string;
  type: "bug" | "feature";
  title: string;
  description: string;
  screenshotUrl: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  creator: { name: string; email: string };
}

const STATUS_META: Record<
  string,
  { label: string; pill: string; icon: string }
> = {
  waiting_initial_review: {
    label: "Pending review",
    pill: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: "text-amber-500",
  },
  reviewed: {
    label: "Reviewed",
    pill: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    icon: "text-blue-500",
  },
  under_development: {
    label: "Under development",
    pill: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    icon: "text-purple-500",
  },
  fixed_shipped: {
    label: "Fixed",
    pill: "bg-green-500/15 text-green-600 dark:text-green-400",
    icon: "text-green-500",
  },
};

const STATUS_ORDER = ["waiting_initial_review", "reviewed", "under_development", "fixed_shipped"];

type StatusFilter = "all" | (typeof STATUS_ORDER)[number];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FeedbackPage() {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [meId, setMeId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // submit dialog state
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "feature">("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReports(data.reports || []);
    } catch {
      toast.error("Could not load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setIsSuperAdmin(d.user?.role === "super_admin");
        setMeId(d.user?.id || "");
      })
      .catch(() => {});
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setScreenshotUrl(data.url);
      toast.success("Screenshot attached");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!title.trim()) return toast.error("Title is required");
    if (!description.trim()) return toast.error("Description is required");
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, description, screenshotUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(type === "bug" ? "Bug report submitted" : "Feature request submitted");
      setOpen(false);
      setTitle("");
      setDescription("");
      setScreenshotUrl("");
      setType("bug");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success("Status updated");
    } catch {
      toast.error("Could not update status");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed");
      }
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Report deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  }

  function copyPrompt(r: FeedbackReport) {
    const prompt = [
      r.type === "bug" ? "Fix this bug reported by a user:" : "Implement this feature requested by a user:",
      "",
      `Title: ${r.title}`,
      "",
      r.description,
      r.screenshotUrl ? `\nScreenshot: ${r.screenshotUrl}` : "",
    ]
      .join("\n")
      .trim();
    navigator.clipboard
      .writeText(prompt)
      .then(() => toast.success("Prompt copied"))
      .catch(() => toast.error("Copy failed"));
  }

  const pendingCount = useMemo(
    () => reports.filter((r) => r.status === "waiting_initial_review").length,
    [reports]
  );

  const filtered = useMemo(
    () => (statusFilter === "all" ? reports : reports.filter((r) => r.status === statusFilter)),
    [reports, statusFilter]
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquareWarning className="h-6 w-6" /> Bugs / Feature request
          </h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button className="gap-2" />}>
            <Plus className="h-4 w-4" /> New Report
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Submit a report</DialogTitle>
              <DialogDescription>
                Found a bug or have an idea? Tell us about it.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Tabs value={type} onValueChange={(v) => setType(v === "feature" ? "feature" : "bug")}>
                <TabsList className="w-full">
                  <TabsTrigger value="bug" className="flex-1 gap-1.5">
                    <Bug className="h-3.5 w-3.5" /> Bug report
                  </TabsTrigger>
                  <TabsTrigger value="feature" className="flex-1 gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5" /> Feature request
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  placeholder={type === "bug" ? "e.g. Preview breaks when…" : "e.g. Add export to CSV"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  rows={5}
                  placeholder={
                    type === "bug"
                      ? "What happened? What did you expect? Steps to reproduce…"
                      : "Describe the feature and why it would help…"
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Screenshot (optional)</Label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
                {screenshotUrl ? (
                  <div className="relative w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshotUrl}
                      alt="Screenshot"
                      className="max-h-40 rounded-md border object-contain"
                    />
                    <Button
                      variant="outline"
                      size="icon-xs"
                      className="absolute -top-2 -right-2 rounded-full"
                      onClick={() => setScreenshotUrl("")}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="gap-2"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                    {uploading ? "Uploading…" : "Attach screenshot"}
                  </Button>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || uploading} className="gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sub-header: summary + status filter pills */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          Bugs &amp; features reported by your team from their dashboards.{" "}
          {pendingCount > 0 && (
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {pendingCount} pending review
            </span>
          )}
        </p>
        <div className="flex items-center gap-1.5 ml-auto">
          {(["all", ...STATUS_ORDER] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              {s === "all" ? "All" : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquareWarning className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">
              {reports.length === 0 ? "No reports yet" : "Nothing with this status"}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {reports.length === 0
                ? "Submit the first bug report or feature request."
                : "Try another filter."}
            </p>
            {reports.length === 0 && (
              <Button onClick={() => setOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> New Report
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const meta = STATUS_META[r.status] || STATUS_META.waiting_initial_review;
            const canDelete = isSuperAdmin || r.createdBy === meId;
            return (
              <Card key={r.id}>
                <CardContent className="pt-5 pb-4">
                  {/* Title row */}
                  <div className="flex items-center gap-2 min-w-0">
                    <CircleDot className={cn("h-4 w-4 shrink-0", meta.icon)} />
                    {r.type === "feature" && (
                      <Lightbulb className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold truncate">{r.title}</h3>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-medium shrink-0",
                        meta.pill
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap line-clamp-4">
                    {r.description}
                  </p>
                  {r.screenshotUrl && (
                    <a
                      href={r.screenshotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.screenshotUrl}
                        alt="Screenshot"
                        className="max-h-32 rounded-md border object-contain hover:opacity-90"
                      />
                    </a>
                  )}

                  {/* Footer row */}
                  <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px]">
                        {(r.creator?.name || "?").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate">
                      {r.creator?.name || "Unknown"}
                      {r.creator?.email ? ` (${r.creator.email})` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground/60">·</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </span>

                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5"
                        onClick={() => copyPrompt(r)}
                        title="Copy as an AI prompt"
                      >
                        <Copy className="h-3.5 w-3.5" /> Prompt
                      </Button>
                      {isSuperAdmin && (
                        <Select value={r.status} onValueChange={(v) => v && changeStatus(r.id, v)}>
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_ORDER.map((s) => (
                              <SelectItem key={s} value={s}>
                                {STATUS_META[s].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-destructive"
                                title="Delete"
                              />
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                              <AlertDialogDescription>
                                “{r.title}” will be removed. This can&apos;t be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(r.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
