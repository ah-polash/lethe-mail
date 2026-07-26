"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Mails, Trash2, Send, Layers, Loader2, DownloadCloud } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { toast } from "sonner";

interface Sequence {
  id: number;
  name: string;
  description: string | null;
  fromEmail: string;
  fromName: string;
  status: "active" | "paused";
  createdAt: string;
  _count: { steps: number; sends: number };
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", fromName: "bPlugins", fromEmail: "" });

  async function load() {
    try {
      const res = await fetch("/api/sequences");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setSequences(data.sequences || []);
    } catch {
      toast.error("Could not load sequences");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleImportFreemius() {
    setImporting(true);
    try {
      const res = await fetch("/api/sequences/import-freemius", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      if (data.created > 0) {
        toast.success(
          `Imported ${data.created} product${data.created === 1 ? "" : "s"} as sequences` +
            (data.skipped ? ` (${data.skipped} already existed)` : "")
        );
      } else {
        toast.info(
          data.total === 0
            ? "No products found in the active Freemius account"
            : `Nothing to import — all ${data.skipped} product(s) already exist`
        );
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(`Sequence #${data.sequence.id} created`);
      setOpen(false);
      setForm({ name: "", description: "", fromName: "bPlugins", fromEmail: "" });
      window.location.href = `/sequences/${data.sequence.id}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/sequences/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Sequence deleted");
      setSequences((s) => s.filter((x) => x.id !== id));
    } catch {
      toast.error("Could not delete");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Mails className="h-6 w-6" /> Email Sequences
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Design a series of AI emails. Fire any step on demand from your own system via a webhook.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleImportFreemius}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DownloadCloud className="h-4 w-4" />
            )}
            Import Freemius Products
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button className="gap-2" />}>
              <Plus className="h-4 w-4" /> New Sequence
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Email Sequence</DialogTitle>
              <DialogDescription>
                Give it a name and default sender. You&apos;ll add email steps next.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="e.g. Plugin onboarding"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder="What is this sequence for?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>From name</Label>
                  <Input
                    placeholder="bPlugins"
                    value={form.fromName}
                    onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From email</Label>
                  <Input
                    placeholder="hello@bplugins.com"
                    value={form.fromEmail}
                    onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating} className="gap-2">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : sequences.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Mails className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">No sequences yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first sequence to start designing emails.
            </p>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> New Sequence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sequences.map((seq) => (
            <Card key={seq.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <span className="truncate">{seq.name}</span>
                      <Badge variant="secondary" className="shrink-0">#{seq.id}</Badge>
                    </CardTitle>
                    {seq.description && (
                      <CardDescription className="mt-1 line-clamp-2">{seq.description}</CardDescription>
                    )}
                  </div>
                  <Badge variant={seq.status === "active" ? "default" : "outline"} className="shrink-0 capitalize">
                    {seq.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Layers className="h-4 w-4" /> {seq._count.steps} step{seq._count.steps === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Send className="h-4 w-4" /> {seq._count.sends} sent
                  </span>
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Link
                  href={`/sequences/${seq.id}`}
                  className={cn(buttonVariants({ variant: "default", size: "sm" }), "flex-1")}
                >
                  Open
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger render={<Button variant="outline" size="icon" />}>
                    <Trash2 className="h-4 w-4" />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete “{seq.name}”?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the sequence, all its steps, and its send history. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(seq.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
