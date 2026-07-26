"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Layers, Trash2, Eye, ArrowRight, Search, LayoutGrid, Columns2, Columns3, Columns4, Grid3x3 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SequenceTemplate {
  id: string;
  name: string;
  subject: string | null;
  htmlContent: string;
  sequenceId: number | null;
  sequenceName: string | null;
  stepNumber: number | null;
  productName: string | null;
  createdAt: string;
}

type ColCount = 1 | 2 | 3 | 4 | 5;

export default function SequenceTemplatesPage() {
  const [templates, setTemplates] = useState<SequenceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sequenceFilter, setSequenceFilter] = useState<string>("all");
  const [previewTemplate, setPreviewTemplate] = useState<SequenceTemplate | null>(null);
  const [cols, setCols] = useState<ColCount>(3);

  useEffect(() => {
    const saved = localStorage.getItem("sequence-templates-grid-cols");
    const n = Number(saved);
    if (n >= 1 && n <= 5) setCols(n as ColCount);
  }, []);

  const updateCols = (n: ColCount) => {
    setCols(n);
    localStorage.setItem("sequence-templates-grid-cols", String(n));
  };

  const gridClass =
    cols === 1
      ? "grid-cols-1"
      : cols === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : cols === 3
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          : cols === 4
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5";

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sequence-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      } else {
        toast.error("Failed to load sequence templates");
      }
    } catch {
      toast.error("Failed to load sequence templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/sequence-templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Template deleted");
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete template");
      }
    } catch {
      toast.error("Failed to delete template");
    }
  };

  const sequences = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of templates) {
      if (t.sequenceId != null) map.set(String(t.sequenceId), t.sequenceName || `Sequence ${t.sequenceId}`);
    }
    return Array.from(map.entries());
  }, [templates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (sequenceFilter !== "all" && String(t.sequenceId) !== sequenceFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.subject || "").toLowerCase().includes(q) ||
        (t.productName || "").toLowerCase().includes(q) ||
        (t.sequenceName || "").toLowerCase().includes(q)
      );
    });
  }, [templates, search, sequenceFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Layers className="h-7 w-7 text-primary" />
            Sequence Templates
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Email templates generated from your sequences via “Generate all email steps”.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border divide-x">
            {([1, 2, 3, 4, 5] as const).map((n) => (
              <button
                key={n}
                onClick={() => updateCols(n)}
                className={cn(
                  "p-1.5 transition-colors",
                  cols === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                )}
                title={`${n} column${n > 1 ? "s" : ""}`}
              >
                {n === 1 && <LayoutGrid className="h-4 w-4" />}
                {n === 2 && <Columns2 className="h-4 w-4" />}
                {n === 3 && <Columns3 className="h-4 w-4" />}
                {n === 4 && <Columns4 className="h-4 w-4" />}
                {n === 5 && <Grid3x3 className="h-4 w-4" />}
              </button>
            ))}
          </div>
          <Link href="/sequences" className={cn(buttonVariants())}>
            Sequences
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-[400px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, subject, or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Select value={sequenceFilter} onValueChange={(v) => v && setSequenceFilter(v)}>
          <SelectTrigger className="h-9 w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sequences</SelectItem>
            {sequences.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name} (#{id})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {templates.length} template{templates.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading templates...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {templates.length === 0
                ? "No sequence templates yet. Open a sequence, pick a product, and click “Generate all email steps”."
                : "No templates match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={cn("grid gap-3", gridClass)}>
          {filtered.map((t) => (
            <Card key={t.id} className="flex flex-col overflow-hidden p-0">
              <button
                type="button"
                onClick={() => setPreviewTemplate(t)}
                className="border-b bg-white h-80 overflow-hidden relative group/thumb text-left"
                title="Click to preview"
              >
                {t.htmlContent ? (
                  <div
                    className="transform scale-[0.25] origin-top-left w-[400%] h-[400%] pointer-events-none"
                    dangerouslySetInnerHTML={{ __html: t.htmlContent }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                    No preview
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/thumb:opacity-100">
                  <span className="bg-white/90 text-foreground rounded-full px-3 py-1 text-xs flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    Preview
                  </span>
                </div>
              </button>
              <CardContent className="p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold truncate flex-1" title={t.name}>
                    {t.name}
                  </h3>
                  {t.stepNumber != null && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      Step {t.stepNumber}
                    </Badge>
                  )}
                </div>
                {t.subject && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{t.subject}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {t.productName && (
                    <Badge variant="outline" className="text-[10px] w-fit">
                      {t.productName}
                    </Badge>
                  )}
                  {t.sequenceName && (
                    <Badge variant="outline" className="text-[10px] w-fit">
                      {t.sequenceName}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-auto">
                  {new Date(t.createdAt).toLocaleString()}
                </p>
                <div className="flex items-center gap-1.5 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={() => setPreviewTemplate(t)}
                  >
                    <Eye className="h-3 w-3 mr-1.5" />
                    Preview
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this template?</AlertDialogTitle>
                        <AlertDialogDescription>
                          “{t.name}” will be removed. This can&apos;t be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(t.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Preview dialog */}
      <Dialog
        open={previewTemplate !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplate(null);
        }}
      >
        <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-[90vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name || "Preview"}</DialogTitle>
            <DialogDescription>
              {previewTemplate?.subject || "No subject"}
              {previewTemplate?.sequenceName ? ` — ${previewTemplate.sequenceName}` : ""}
              {previewTemplate?.stepNumber != null ? ` · Step ${previewTemplate.stepNumber}` : ""}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[68vh] border bg-white">
            <div
              className="max-w-[600px] mx-auto p-4"
              dangerouslySetInnerHTML={{ __html: previewTemplate?.htmlContent || "" }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
