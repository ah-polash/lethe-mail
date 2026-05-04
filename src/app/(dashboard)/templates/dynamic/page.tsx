"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, Trash2, Eye, ArrowRight, Search } from "lucide-react";
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

interface DynamicTemplate {
  id: string;
  name: string;
  subject: string | null;
  htmlContent: string;
  source: string; // "manual" | "ai"
  aiMode: string | null;
  prompt: string | null;
  createdAt: string;
}

type SourceFilter = "all" | "manual" | "ai";
type ModeFilter = "all" | "true" | "product-update";

export default function DynamicTemplatesPage() {
  const [templates, setTemplates] = useState<DynamicTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [previewTemplate, setPreviewTemplate] = useState<DynamicTemplate | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dynamic-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      } else {
        toast.error("Failed to load dynamic templates");
      }
    } catch {
      toast.error("Failed to load dynamic templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/dynamic-templates/${id}`, { method: "DELETE" });
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (sourceFilter !== "all" && t.source !== sourceFilter) return false;
      if (modeFilter !== "all" && (t.aiMode || "") !== modeFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.subject || "").toLowerCase().includes(q) ||
        (t.prompt || "").toLowerCase().includes(q)
      );
    });
  }, [templates, search, sourceFilter, modeFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-amber-500" />
            Dynamic Templates
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            AI-generated and manually saved templates with dynamic variable placeholders.
          </p>
        </div>
        <Link
          href="/campaigns/swipeone/new"
          className={cn(buttonVariants())}
        >
          New Campaign
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-[400px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, subject, or prompt..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Select value={sourceFilter} onValueChange={(v) => v && setSourceFilter(v as SourceFilter)}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="ai">AI-generated</SelectItem>
            <SelectItem value="manual">Saved manually</SelectItem>
          </SelectContent>
        </Select>
        <Select value={modeFilter} onValueChange={(v) => v && setModeFilter(v as ModeFilter)}>
          <SelectTrigger className="h-9 w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All AI modes</SelectItem>
            <SelectItem value="true">Regular Email</SelectItem>
            <SelectItem value="product-update">Product Feature Update</SelectItem>
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
            <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {templates.length === 0
                ? "No dynamic templates yet. Generate one with AI or save HTML from the campaign editor."
                : "No templates match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardContent className="p-4 flex flex-col gap-2 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold truncate flex-1" title={t.name}>
                    {t.name}
                  </h3>
                  <Badge
                    variant={t.source === "manual" ? "default" : "secondary"}
                    className="text-[10px] shrink-0"
                  >
                    {t.source === "manual" ? "Saved" : "AI"}
                  </Badge>
                </div>
                {t.subject && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{t.subject}</p>
                )}
                {t.aiMode && (
                  <Badge variant="outline" className="text-[10px] w-fit">
                    {t.aiMode === "product-update" ? "Product Update" : "Regular"}
                  </Badge>
                )}
                {t.prompt && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
                    “{t.prompt}”
                  </p>
                )}
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
              {previewTemplate?.subject || "No subject"} —{" "}
              {previewTemplate?.source === "manual" ? "Saved" : "AI"}{" "}
              {previewTemplate?.aiMode &&
                `(${previewTemplate.aiMode === "product-update" ? "Product Update" : "Regular"})`}
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
