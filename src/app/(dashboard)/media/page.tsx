"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon, Upload, Search, Trash2, Copy, Check, Loader2,
  FileText, Film, Code2, Pencil, Sparkles, Wand2, PenTool,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface MediaAsset {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  altText: string | null;
  source?: string;
  aiPrompt?: string | null;
  aiModel?: string | null;
  createdAt: string;
  creator?: { name: string };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function isImage(m: string) {
  return m.startsWith("image/");
}

function KindIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith("video/")) return <Film className={className} />;
  if (mimeType === "application/pdf") return <FileText className={className} />;
  return <ImageIcon className={className} />;
}

export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [editName, setEditName] = useState("");
  const [editAlt, setEditAlt] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // AI generator
  const [genOpen, setGenOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState("");
  const [genStyle, setGenStyle] = useState("hero");
  const [genAspect, setGenAspect] = useState("banner");
  const [genModel, setGenModel] = useState("google/gemini-2.5-flash-image");
  const [genCount, setGenCount] = useState("1");
  const [generating, setGenerating] = useState(false);
  const [models, setModels] = useState<{ id: string; label: string; note: string; approxCost: string }[]>([]);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [imageEngineAvailable, setImageEngineAvailable] = useState(true);
  const [cliEngineAvailable, setCliEngineAvailable] = useState(false);
  const [engine, setEngine] = useState<"openrouter" | "cli">("openrouter");

  // Vector-from-email generator
  const [vecOpen, setVecOpen] = useState(false);
  const [vecEmailText, setVecEmailText] = useState("");
  const [vecStyle, setVecStyle] = useState("hero");
  const [vecAspect, setVecAspect] = useState("banner");
  const [vecFormat, setVecFormat] = useState<"png" | "gif" | "apng">("png");
  const [vecFrames, setVecFrames] = useState("6");
  const [vecBusy, setVecBusy] = useState(false);
  const [vecResult, setVecResult] = useState<{ url: string; title: string; altText: string; dimensions: string } | null>(null);
  const [sourceFilter, setSourceFilter] = useState<"all" | "ai" | "upload">("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/media");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAssets(data.assets || []);
    } catch {
      toast.error("Could not load the media library");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/media/generate")
      .then((r) => r.json())
      .then((d) => {
        setModels(d.models || []);
        setActiveProvider(d.activeProvider ?? null);
        setImageEngineAvailable(d.imageEngineAvailable !== false);
        setCliEngineAvailable(!!d.cliEngineAvailable);
        // Prefer the free local engine when the paid one is unavailable.
        if (d.cliEngineAvailable && d.imageEngineAvailable === false) setEngine("cli");
      })
      .catch(() => {});
  }, []);

  const generateVector = async () => {
    if (vecEmailText.trim().length < 40) {
      toast.error("Paste a bit more of the email so the artwork can match it");
      return;
    }
    setVecBusy(true);
    setVecResult(null);
    try {
      const res = await fetch("/api/media/vector", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailText: vecEmailText, style: vecStyle, aspect: vecAspect,
          format: vecFormat, frames: Number(vecFrames),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Vector generation failed");
      setVecResult({
        url: data.asset.url,
        title: data.title,
        altText: data.altText,
        dimensions: `${data.dimensions}${data.frameCount > 1 ? ` · ${data.frameCount} frames` : ""}`,
      });
      toast.success("Vector saved to your library");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Vector generation failed");
    } finally {
      setVecBusy(false);
    }
  };

  const generate = async () => {
    if (!genPrompt.trim()) { toast.error("Describe the image you want"); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: genPrompt, style: genStyle, aspect: genAspect,
          model: genModel, count: Number(genCount), engine,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const n = data.assets?.length || 0;
      toast.success(`Generated ${n} image${n === 1 ? "" : "s"}${data.cost ? ` · $${Number(data.cost).toFixed(3)}` : ""}`);
      if (data.notice) toast.info(data.notice);
      setGenOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(list.length);
    let ok = 0;
    for (const file of list) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/media", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");
        ok++;
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "Upload failed"}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (ok > 0) toast.success(`Uploaded ${ok} file${ok === 1 ? "" : "s"}`);
    await load();
  }, [load]);

  const copy = (a: MediaAsset) => {
    navigator.clipboard.writeText(a.url).then(() => {
      setCopiedId(a.id);
      toast.success("URL copied");
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => toast.error("Copy failed"));
  };

  const copyEmbed = (a: MediaAsset) => {
    const snippet = isImage(a.mimeType)
      ? `<img src="${a.url}" alt="${a.altText || a.name}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />`
      : `<a href="${a.url}">${a.altText || a.name}</a>`;
    navigator.clipboard.writeText(snippet).then(() => toast.success("Email HTML copied"))
      .catch(() => toast.error("Copy failed"));
  };

  const remove = async (a: MediaAsset) => {
    try {
      const res = await fetch(`/api/media/${a.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Delete failed");
      if (data.storageError) toast.warning("Removed from the library, but the stored file may remain.");
      else toast.success("Deleted");
      setAssets((prev) => prev.filter((x) => x.id !== a.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const res = await fetch(`/api/media/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, altText: editAlt }),
      });
      if (!res.ok) throw new Error();
      setAssets((prev) => prev.map((x) => x.id === editing.id ? { ...x, name: editName, altText: editAlt || null } : x));
      setEditing(null);
      toast.success("Saved");
    } catch {
      toast.error("Could not save");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (sourceFilter === "ai" && a.source !== "ai") return false;
      if (sourceFilter === "upload" && a.source === "ai") return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.altText || "").toLowerCase().includes(q) ||
        (a.aiPrompt || "").toLowerCase().includes(q)
      );
    });
  }, [assets, search, sourceFilter]);

  const totalSize = useMemo(() => assets.reduce((s, a) => s + a.size, 0), [assets]);

  return (
    <div
      className="mx-auto max-w-6xl space-y-5"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ImageIcon className="h-6 w-6" /> Media Library
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload images once and embed them in any email. {assets.length} file
            {assets.length === 1 ? "" : "s"} · {formatBytes(totalSize)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf,video/mp4,video/webm"
            onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ""; }}
          />
          {cliEngineAvailable && (
            <Button variant="outline" onClick={() => setVecOpen(true)} className="gap-2">
              <PenTool className="h-4 w-4" />
              AI Vector generator
            </Button>
          )}
          <Button variant="outline" onClick={() => setGenOpen(true)} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Generate with AI
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={uploading > 0} className="gap-2">
            {uploading > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading > 0 ? `Uploading ${uploading}…` : "Upload"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(["all", "ai", "upload"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSourceFilter(k)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              sourceFilter === k ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-accent"
            )}
          >
            {k === "all" ? "All" : k === "ai" ? "AI generated" : "Uploaded"}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search media…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-8"
        />
      </div>

      {dragging && (
        <div className="rounded-xl border-2 border-dashed border-primary bg-primary/5 py-10 text-center text-sm font-medium text-primary">
          Drop files to upload
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium">{assets.length === 0 ? "No media yet" : "Nothing matches that search"}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {assets.length === 0
                ? "Upload images here, then insert them into any email."
                : "Try a different term."}
            </p>
            {assets.length === 0 && (
              <Button onClick={() => fileRef.current?.click()} className="gap-2">
                <Upload className="h-4 w-4" /> Upload your first file
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((a) => (
            <Card key={a.id} className="overflow-hidden p-0 flex flex-col group">
              <div className="relative h-36 bg-muted/40 flex items-center justify-center overflow-hidden">
                {isImage(a.mimeType) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={a.url} alt={a.altText || a.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                ) : (
                  <KindIcon mimeType={a.mimeType} className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <CardContent className="p-2.5 flex flex-col gap-1.5 flex-1">
                <p className="text-xs font-medium truncate" title={a.name}>{a.name}</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {formatBytes(a.size)} · {a.mimeType.split("/")[1]}
                  {a.source === "ai" && (
                    <Badge variant="secondary" className="ml-auto gap-0.5 px-1 py-0 text-[9px]">
                      <Sparkles className="h-2.5 w-2.5" /> AI
                    </Badge>
                  )}
                </p>
                {a.aiPrompt && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2 italic" title={a.aiPrompt}>
                    “{a.aiPrompt}”
                  </p>
                )}
                <div className="flex items-center gap-1 mt-auto pt-1.5 border-t">
                  <Button variant="ghost" size="icon-sm" title="Copy URL" onClick={() => copy(a)}>
                    {copiedId === a.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon-sm" title="Copy email HTML" onClick={() => copyEmbed(a)}>
                    <Code2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon-sm" title="Rename / alt text"
                    onClick={() => { setEditing(a); setEditName(a.name); setEditAlt(a.altText || ""); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={<Button variant="ghost" size="icon-sm" className="ml-auto text-muted-foreground hover:text-destructive" title="Delete" />}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete “{a.name}”?</AlertDialogTitle>
                        <AlertDialogDescription>
                          The file is removed from storage. Emails already sent keep working only
                          if they were delivered before deletion — any email still referencing this
                          URL will show a broken image.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(a)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}



      {/* Vector art derived from the email copy */}
      <Dialog open={vecOpen} onOpenChange={(o) => { if (!vecBusy) { setVecOpen(o); if (!o) setVecResult(null); } }}>
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-primary" /> AI Vector generator
            </DialogTitle>
            <DialogDescription>
              Paste your email text. Claude reads it, designs matching artwork, and saves it to your
              library with a name and alt text — no API credits, exact dimensions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-1 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-1.5">
              <Label>Email text</Label>
              <Textarea
                rows={16}
                autoFocus
                className="font-mono text-xs"
                placeholder={"Paste the subject line and body of your email here…\n\nThe illustration is designed from what the email is actually about, so more copy gives a better match."}
                value={vecEmailText}
                onChange={(e) => setVecEmailText(e.target.value)}
                disabled={vecBusy}
              />
              <p className="text-[11px] text-muted-foreground">
                {vecEmailText.trim().length} characters
                {vecEmailText.trim().length > 0 && vecEmailText.trim().length < 40 && " · paste a little more"}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Art direction</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { k: "hero", label: "Email hero" },
                    { k: "illustration", label: "Illustration" },
                    { k: "background", label: "Background" },
                    { k: "icon", label: "Icon" },
                    { k: "product", label: "Product" },
                  ].map((o) => (
                    <button
                      key={o.k}
                      type="button"
                      disabled={vecBusy}
                      onClick={() => setVecStyle(o.k)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                        vecStyle === o.k ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Output</Label>
                <div className="grid gap-1.5">
                  {[
                    { k: "png" as const, label: "PNG (static)", note: "Renders everywhere — the safe default." },
                    { k: "gif" as const, label: "Animated GIF", note: "Animates in most clients; Outlook shows frame 1. 256 colours." },
                    { k: "apng" as const, label: "Animated PNG (APNG)", note: "Full colour, but only Apple Mail animates it." },
                  ].map((o) => (
                    <button
                      key={o.k}
                      type="button"
                      disabled={vecBusy}
                      onClick={() => setVecFormat(o.k)}
                      className={cn(
                        "rounded-lg border p-2 text-left transition-colors",
                        vecFormat === o.k ? "border-primary bg-primary/5" : "hover:bg-accent"
                      )}
                    >
                      <span className="block text-xs font-medium">{o.label}</span>
                      <span className="block text-[10px] text-muted-foreground">{o.note}</span>
                    </button>
                  ))}
                </div>
              </div>

              {vecFormat !== "png" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Frames</Label>
                  <Select value={vecFrames} onValueChange={(v) => v && setVecFrames(v)} disabled={vecBusy}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["3", "4", "6", "8"].map((n) => (
                        <SelectItem key={n} value={n}>{n} frames</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Each frame is drawn separately, so more frames means a smoother loop and a
                    longer wait.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Shape</Label>
                <Select value={vecAspect} onValueChange={(v) => v && setVecAspect(v)} disabled={vecBusy}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banner">Email banner — 1200×300</SelectItem>
                    <SelectItem value="landscape">Landscape — 1200×675</SelectItem>
                    <SelectItem value="square">Square — 1024×1024</SelectItem>
                    <SelectItem value="portrait">Portrait — 900×1200</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Vector art is drawn on this exact canvas, so the size is guaranteed.
                </p>
              </div>

              {vecResult ? (
                <div className="space-y-2 rounded-lg border p-2.5">
                  <p className="text-xs font-medium">Saved to library</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={vecResult.url} alt={vecResult.altText} className="w-full rounded border" />
                  <p className="text-[11px]"><span className="text-muted-foreground">Name:</span> {vecResult.title}</p>
                  <p className="text-[11px]"><span className="text-muted-foreground">Alt text:</span> {vecResult.altText}</p>
                  <p className="text-[11px] text-muted-foreground">{vecResult.dimensions}</p>
                </div>
              ) : (
                <p className="rounded-md border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                  Vector art suits banners, backgrounds, patterns, icons and flat illustration.
                  It cannot produce photographs or realistic people. Takes around a minute.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVecOpen(false)} disabled={vecBusy}>
              {vecResult ? "Done" : "Cancel"}
            </Button>
            <Button onClick={generateVector} disabled={vecBusy || vecEmailText.trim().length < 40} className="gap-2">
              {vecBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenTool className="h-4 w-4" />}
              {vecBusy ? "Designing…" : vecResult ? "Generate another" : "Generate vector"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI image generator */}
      <Dialog open={genOpen} onOpenChange={(o) => !generating && setGenOpen(o)}>
        <DialogContent className="max-w-[95vw] sm:max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Generate an image
            </DialogTitle>
            <DialogDescription>
              Describe what you want. Generated images are added straight to your library.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-1 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-1.5">
              <Label>Prompt</Label>
              <Textarea
                rows={10}
                autoFocus
                placeholder="e.g. a friendly illustration of a support engineer helping a customer, soft blue palette"
                value={genPrompt}
                onChange={(e) => setGenPrompt(e.target.value)}
                disabled={generating}
              />
              <p className="text-[11px] text-muted-foreground">
                Avoid asking for text inside the image — models render lettering unreliably. Put
                wording in the email HTML instead.
              </p>
            </div>

            <div className="space-y-4">
            {cliEngineAvailable && (
              <div className="space-y-1.5">
                <Label className="text-xs">Engine</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => setEngine("openrouter")}
                    className={cn(
                      "rounded-lg border p-2 text-left text-xs transition-colors",
                      engine === "openrouter" ? "border-primary bg-primary/5" : "hover:bg-accent"
                    )}
                  >
                    <span className="block font-medium">AI image model</span>
                    <span className="text-[10px] text-muted-foreground">
                      Photoreal, ~$0.04+/image
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={generating}
                    onClick={() => setEngine("cli")}
                    className={cn(
                      "rounded-lg border p-2 text-left text-xs transition-colors",
                      engine === "cli" ? "border-primary bg-primary/5" : "hover:bg-accent"
                    )}
                  >
                    <span className="block font-medium">Vector (local Claude)</span>
                    <span className="text-[10px] text-muted-foreground">
                      No API credits · exact size
                    </span>
                  </button>
                </div>
                {engine === "cli" && (
                  <p className="text-[11px] text-muted-foreground">
                    Claude writes SVG artwork and it is rendered to PNG here — this uses your Claude
                    subscription rather than API credits, and the shape is exact. Great for banners, backgrounds, patterns and icons;
                    it cannot produce photographs or realistic people.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Style</Label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { k: "hero", label: "Email hero" },
                  { k: "product", label: "Product shot" },
                  { k: "illustration", label: "Illustration" },
                  { k: "icon", label: "Icon" },
                  { k: "background", label: "Background" },
                  { k: "photo", label: "Photo" },
                  { k: "none", label: "No preset" },
                ].map((o) => (
                  <button
                    key={o.k}
                    type="button"
                    disabled={generating}
                    onClick={() => setGenStyle(o.k)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      genStyle === o.k ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Shape</Label>
                <Select value={genAspect} onValueChange={(v) => v && setGenAspect(v)} disabled={generating}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banner">Email banner (wide 3:1)</SelectItem>
                    <SelectItem value="landscape">Landscape (16:9)</SelectItem>
                    <SelectItem value="square">Square (1:1)</SelectItem>
                    <SelectItem value="portrait">Portrait (3:4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">How many</Label>
                <Select value={genCount} onValueChange={(v) => v && setGenCount(v)} disabled={generating}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["1", "2", "3", "4"].map((n) => (
                      <SelectItem key={n} value={n}>{n} variation{n === "1" ? "" : "s"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {engine === "cli" ? null : activeProvider === "claude-cli" ? (
              <p className="rounded-md border bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
                Your active connection is the local Claude CLI, which cannot create images.
                {imageEngineAvailable
                  ? " Image generation will use your OpenRouter connection instead."
                  : " Add an OpenRouter connection in Settings → AI Configuration to enable this."}
              </p>
            ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Model</Label>
              <Select value={genModel} onValueChange={(v) => v && setGenModel(v)} disabled={generating}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label} — {m.approxCost}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {models.find((m) => m.id === genModel)?.note || ""}
                {genCount !== "1" && " · cost applies per variation"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Shape is a request, not a guarantee — some models return a square regardless.
                Resize in the email HTML if needed.
              </p>
            </div>
            )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button onClick={generate} disabled={generating || !genPrompt.trim() || (engine === "openrouter" && !imageEngineAvailable)} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {generating ? "Generating…" : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit media</DialogTitle>
            <DialogDescription>The alt text is used when inserting this into an email.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Alt text</Label>
              <Input value={editAlt} onChange={(e) => setEditAlt(e.target.value)} placeholder="Describe the image" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
