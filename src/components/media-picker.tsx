"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, Search, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Asset {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  altText: string | null;
}

// Email-safe markup: fixed max width, block display, no border — the combination
// that renders consistently across Outlook/Gmail clients.
export function embedSnippet(a: { url: string; name: string; altText?: string | null; mimeType: string }): string {
  if (a.mimeType.startsWith("image/")) {
    return `<img src="${a.url}" alt="${a.altText || a.name}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" />`;
  }
  return `<a href="${a.url}">${a.altText || a.name}</a>`;
}

/**
 * Media picker dialog. `onInsert` receives ready-to-paste email HTML.
 */
export function MediaPicker({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (html: string, asset: Asset) => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/media");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAssets(data.assets || []);
    } catch {
      toast.error("Could not load media");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", files[0]);
      const res = await fetch("/api/media", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      toast.success("Uploaded");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? assets.filter((a) => a.name.toLowerCase().includes(q)) : assets;
  }, [assets, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" /> Insert media
          </DialogTitle>
          <DialogDescription>
            Click a file to insert it into the email at your cursor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="h-9 pl-8"
              placeholder="Search media…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className={cn("shrink-0", uploading && "pointer-events-none opacity-60")}>
            <input
              type="file"
              className="hidden"
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
              onChange={(e) => { upload(e.target.files); e.target.value = ""; }}
            />
            <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-accent">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload
            </span>
          </label>
        </div>

        <div className="max-h-[55vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              {assets.length === 0 ? "No media yet — upload one to get started." : "Nothing matches that search."}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { onInsert(embedSnippet(a), a); onOpenChange(false); }}
                  className="group overflow-hidden rounded-lg border text-left transition-colors hover:border-primary"
                  title={`Insert ${a.name}`}
                >
                  <div className="h-24 bg-muted/40 flex items-center justify-center overflow-hidden">
                    {a.mimeType.startsWith("image/") ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={a.url} alt={a.altText || a.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <p className="truncate px-2 py-1.5 text-[11px]">{a.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
