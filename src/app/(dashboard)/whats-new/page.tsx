"use client";

import { useEffect, useState } from "react";
import { Megaphone, Plus, Loader2, Trash2, Rocket, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥"];

interface Feature {
  id: string;
  title: string;
  description: string;
  status: "upcoming" | "shipped";
  createdAt: string;
  counts: Record<string, number>;
  mine: string[];
  totalReactions: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function WhatsNewPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // create dialog (admin)
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"upcoming" | "shipped">("upcoming");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/whats-new");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFeatures(data.features || []);
    } catch {
      toast.error("Could not load announcements");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsSuperAdmin(d.user?.role === "super_admin"))
      .catch(() => {});
  }, []);

  async function handleCreate() {
    if (!title.trim()) return toast.error("Title is required");
    if (!description.trim()) return toast.error("Description is required");
    setSubmitting(true);
    try {
      const res = await fetch("/api/whats-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Announcement published");
      setOpen(false);
      setTitle("");
      setDescription("");
      setStatus("upcoming");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleReaction(featureId: string, emoji: string) {
    // optimistic update
    setFeatures((prev) =>
      prev.map((f) => {
        if (f.id !== featureId) return f;
        const had = f.mine.includes(emoji);
        const counts = { ...f.counts, [emoji]: Math.max(0, (f.counts[emoji] || 0) + (had ? -1 : 1)) };
        return {
          ...f,
          counts,
          mine: had ? f.mine.filter((e) => e !== emoji) : [...f.mine, emoji],
          totalReactions: f.totalReactions + (had ? -1 : 1),
        };
      })
    );
    try {
      const res = await fetch(`/api/whats-new/${featureId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Could not save reaction");
      await load(); // resync
    }
  }

  async function changeStatus(id: string, next: "upcoming" | "shipped") {
    try {
      const res = await fetch(`/api/whats-new/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, status: next } : f)));
      toast.success(next === "shipped" ? "Marked as shipped" : "Marked as upcoming");
    } catch {
      toast.error("Could not update");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/whats-new/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setFeatures((prev) => prev.filter((f) => f.id !== id));
      toast.success("Announcement deleted");
    } catch {
      toast.error("Could not delete");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6" /> What&apos;s New
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            New and upcoming features. React to tell us what you&apos;re excited about.
          </p>
        </div>
        {isSuperAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="gap-2" />}>
              <Plus className="h-4 w-4" /> New Announcement
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>New announcement</DialogTitle>
                <DialogDescription>Tell users what&apos;s coming or what just shipped.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <Tabs value={status} onValueChange={(v) => setStatus(v === "shipped" ? "shipped" : "upcoming")}>
                  <TabsList className="w-full">
                    <TabsTrigger value="upcoming" className="flex-1 gap-1.5">
                      <Rocket className="h-3.5 w-3.5" /> Coming soon
                    </TabsTrigger>
                    <TabsTrigger value="shipped" className="flex-1 gap-1.5">
                      <PackageCheck className="h-3.5 w-3.5" /> Shipped
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    placeholder="e.g. Automation workflows"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    rows={5}
                    placeholder="What is it, and why will users love it?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Publish
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : features.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">Nothing announced yet</p>
            <p className="text-sm text-muted-foreground">
              {isSuperAdmin ? "Publish your first announcement." : "Check back soon for upcoming features."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {features.map((f) => (
            <Card key={f.id}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium shrink-0 inline-flex items-center gap-1",
                      f.status === "shipped"
                        ? "bg-green-500/15 text-green-600 dark:text-green-400"
                        : "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                    )}
                  >
                    {f.status === "shipped" ? (
                      <>
                        <PackageCheck className="h-3 w-3" /> Shipped
                      </>
                    ) : (
                      <>
                        <Rocket className="h-3 w-3" /> Coming soon
                      </>
                    )}
                  </span>
                  <h3 className="font-semibold truncate">{f.title}</h3>
                  <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                    {formatDate(f.createdAt)}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                  {f.description}
                </p>

                <div className="flex items-center gap-1.5 mt-4 pt-3 border-t">
                  {REACTIONS.map((emoji) => {
                    const count = f.counts[emoji] || 0;
                    const mine = f.mine.includes(emoji);
                    return (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(f.id, emoji)}
                        title={mine ? "Remove reaction" : "React"}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors",
                          mine
                            ? "border-primary bg-primary/10"
                            : "hover:bg-accent border-border"
                        )}
                      >
                        <span>{emoji}</span>
                        {count > 0 && (
                          <span className={cn("text-xs", mine ? "text-primary font-semibold" : "text-muted-foreground")}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {isSuperAdmin && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-xs text-muted-foreground mr-1">
                        {f.totalReactions} reaction{f.totalReactions === 1 ? "" : "s"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => changeStatus(f.id, f.status === "shipped" ? "upcoming" : "shipped")}
                      >
                        {f.status === "shipped" ? "Mark upcoming" : "Mark shipped"}
                      </Button>
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
                            <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
                            <AlertDialogDescription>
                              “{f.title}” and its reactions will be removed. This can&apos;t be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(f.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
