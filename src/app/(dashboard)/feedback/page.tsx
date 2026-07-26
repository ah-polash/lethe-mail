"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bug,
  Lightbulb,
  Plus,
  Loader2,
  ImagePlus,
  X,
  Trash2,
  MessageSquareWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
  creator: { name: string };
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  waiting_initial_review: { label: "Waiting Initial Review", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  reviewed: { label: "Reviewed", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  under_development: { label: "Under Development", className: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  fixed_shipped: { label: "Fixed / Shipped", className: "bg-green-500/15 text-green-600 dark:text-green-400" },
};

const STATUS_ORDER = ["waiting_initial_review", "reviewed", "under_development", "fixed_shipped"];

export default function FeedbackPage() {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [meId, setMeId] = useState("");

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquareWarning className="h-6 w-6" /> Bug report &amp; Feature request
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Report a bug or request a feature — track its status here as it moves through review.
          </p>
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

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : reports.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquareWarning className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No reports yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Submit the first bug report or feature request.
            </p>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> New Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const meta = STATUS_META[r.status] || STATUS_META.waiting_initial_review;
            return (
              <Card key={r.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="gap-1 text-[10px] shrink-0">
                          {r.type === "bug" ? (
                            <>
                              <Bug className="h-3 w-3" /> Bug
                            </>
                          ) : (
                            <>
                              <Lightbulb className="h-3 w-3" /> Feature
                            </>
                          )}
                        </Badge>
                        <h3 className="font-semibold truncate">{r.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-4">
                        {r.description}
                      </p>
                      {r.screenshotUrl && (
                        <a href={r.screenshotUrl} target="_blank" rel="noreferrer" className="inline-block mt-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={r.screenshotUrl}
                            alt="Screenshot"
                            className="max-h-32 rounded-md border object-contain hover:opacity-90"
                          />
                        </a>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-2">
                        {r.creator?.name || "Unknown"} · {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {isSuperAdmin ? (
                        <Select value={r.status} onValueChange={(v) => v && changeStatus(r.id, v)}>
                          <SelectTrigger className="h-8 w-[200px]">
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
                      ) : (
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", meta.className)}>
                          {meta.label}
                        </span>
                      )}
                      {isSuperAdmin && (
                        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", meta.className)}>
                          {meta.label}
                        </span>
                      )}
                      {(isSuperAdmin || r.createdBy === meId) && (
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
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
