"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Loader2, Code, Blocks, Eye, EyeOff, History, Upload, X, ImageIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailEditor, type EmailBlock } from "@/components/email-editor/editor";
import { toast } from "sonner";

interface SavedPrompt {
  id: string;
  prompt: string;
  style: string;
  name: string | null;
  subject: string | null;
  createdAt: string;
}

function NewTemplateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aiMode = searchParams.get("ai"); // "true" | "screenshot" | null
  const showAI = aiMode === "true" || aiMode === "screenshot";
  const isScreenshotMode = aiMode === "screenshot";

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [jsonContent, setJsonContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // AI Generation
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("professional");
  const [generating, setGenerating] = useState(false);
  const [editorBlocks, setEditorBlocks] = useState<EmailBlock[]>([]);

  // Previous prompts
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptsOpen, setPromptsOpen] = useState(false);

  const fetchSavedPrompts = async () => {
    setPromptsLoading(true);
    try {
      const res = await fetch("/api/ai-prompts");
      if (res.ok) {
        const data = await res.json();
        setSavedPrompts(data.prompts || []);
      }
    } catch { /* ignore */ }
    finally { setPromptsLoading(false); }
  };

  // Screenshot / image upload
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setReferenceImageUrl(data.url);
        toast.success("Image uploaded");
      } else {
        const data = await res.json();
        toast.error(data.error || "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  const applyPrompt = (p: SavedPrompt) => {
    setAiPrompt(p.prompt);
    setAiStyle(p.style || "professional");
    if (p.name) setName(p.name);
    if (p.subject) setSubject(p.subject);
    setPromptsOpen(false);
    toast.success("Prompt loaded! Click Generate to create the template.");
  };

  // Update iframe preview when htmlContent changes in HTML mode
  useEffect(() => {
    if (isHtmlMode && showPreview && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
      }
    }
  }, [htmlContent, isHtmlMode, showPreview]);

  const handleEditorChange = (data: { html: string; json: string }) => {
    setHtmlContent(data.html);
    setJsonContent(data.json);
  };

  const handleGenerateAI = async () => {
    if (!aiPrompt && !referenceImageUrl) {
      toast.error("Please enter a prompt or upload a screenshot");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt || "Recreate this email design as an HTML email template.",
          style: aiStyle,
          templateName: name,
          templateSubject: subject,
          ...(referenceImageUrl && { referenceImageUrl }),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // API returns { html, subject }
        const generatedHtml = data.html || "";
        setHtmlContent(generatedHtml);
        setJsonContent(""); // AI generates raw HTML, not block JSON
        setEditorBlocks([]);
        setIsHtmlMode(true); // Switch to HTML mode to show the result
        if (data.subject && !subject) setSubject(data.subject);
        toast.success("Template generated! Edit the HTML below or switch to block editor.");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to generate template");
      }
    } catch {
      toast.error("Failed to generate template");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!name) {
      toast.error("Template name is required");
      return;
    }
    if (!htmlContent) {
      toast.error("Template content is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          htmlContent,
          jsonContent: isHtmlMode ? "" : jsonContent,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Template saved");
        router.push(`/templates/${data.template.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save template");
      }
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col -mx-6 lg:-mx-8 -mb-6 lg:-mb-8 -mt-16 lg:-mt-8 h-screen [&_*]:!rounded-none">
      {/* ── Header (pinned) ────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 lg:px-8 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <Link href="/templates" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold">
            {isScreenshotMode ? "Screenshot to AI Email" : "New Template"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {showAI && (
            <Popover open={promptsOpen} onOpenChange={(open) => {
              setPromptsOpen(open);
              if (open && savedPrompts.length === 0) fetchSavedPrompts();
            }}>
              <PopoverTrigger render={
                <Button variant="outline" size="sm" className="h-8">
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  Use Previous Prompts
                </Button>
              } />
              <PopoverContent align="end" className="w-[420px] p-0">
                <div className="px-3 pt-3 pb-2">
                  <p className="text-sm font-medium">Previous Prompts</p>
                  <p className="text-xs text-muted-foreground">Click a prompt to fill the form</p>
                </div>
                <Separator />
                <ScrollArea className="max-h-[360px]">
                  {promptsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : savedPrompts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No previous prompts yet. Generate a template to save your first prompt.
                    </p>
                  ) : (
                    <div className="p-1">
                      {savedPrompts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => applyPrompt(p)}
                          className="w-full text-left rounded-md px-3 py-2.5 hover:bg-accent transition-colors"
                        >
                          <p className="text-sm line-clamp-2">{p.prompt}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{p.style}</Badge>
                            {p.name && <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{p.name}</span>}
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {new Date(p.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}
          {isHtmlMode && (
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? <EyeOff className="h-3.5 w-3.5 mr-1.5" /> : <Eye className="h-3.5 w-3.5 mr-1.5" />}
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setIsHtmlMode(!isHtmlMode)}
          >
            {isHtmlMode ? <Blocks className="h-3.5 w-3.5 mr-1.5" /> : <Code className="h-3.5 w-3.5 mr-1.5" />}
            {isHtmlMode ? "Block Editor" : "HTML Editor"}
          </Button>
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="px-6 lg:px-8 py-4 space-y-4">
          {/* Template Details – slim inline row */}
          <div className="flex items-center gap-3">
            <Input
              placeholder="Template name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 max-w-[280px]"
            />
            <Input
              placeholder="Default subject line"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-9 max-w-[320px]"
            />
          </div>

          {/* AI Generation */}
          {showAI && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {isScreenshotMode ? <ImageIcon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  {isScreenshotMode ? "Screenshot to AI Email" : "AI Template Generator"}
                </div>

                {/* Screenshot upload area */}
                {isScreenshotMode && (
                  <div className="space-y-2">
                    <Label>Design Reference Screenshot</Label>
                    {referenceImageUrl ? (
                      <div className="relative inline-block">
                        <img
                          src={referenceImageUrl}
                          alt="Reference"
                          className="max-h-[200px] border object-contain bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => setReferenceImageUrl("")}
                          className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center bg-destructive text-white text-xs hover:bg-destructive/90 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                            e.target.value = "";
                          }}
                        />
                        {uploading ? (
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Uploading...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Drop an image here or click to upload
                            </p>
                            <p className="text-xs text-muted-foreground">
                              PNG, JPG, GIF, WebP up to 10MB
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Textarea
                    id="ai-prompt"
                    placeholder={isScreenshotMode
                      ? "Describe any changes you want (or leave empty to recreate the screenshot as-is)"
                      : "e.g. A welcome email for new SaaS subscribers with a CTA to start their free trial"
                    }
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={2}
                    className="flex-1"
                  />
                  <div className="flex flex-col gap-2">
                    <Select value={aiStyle} onValueChange={(v) => v && setAiStyle(v)}>
                      <SelectTrigger className="h-9 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                        <SelectItem value="bold">Bold & Colorful</SelectItem>
                        <SelectItem value="elegant">Elegant</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleGenerateAI}
                      disabled={generating || (isScreenshotMode && !referenceImageUrl && !aiPrompt)}
                      size="sm"
                      className="h-9"
                    >
                      {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                      {generating ? "Generating..." : "Generate"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Editor */}
          {isHtmlMode ? (
            <div className={`grid gap-4 ${showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
              <div className="space-y-2">
                <Label>HTML Code</Label>
                <textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full min-h-[600px] font-mono text-sm p-4 border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  spellCheck={false}
                />
              </div>
              {showPreview && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="border overflow-hidden bg-white" style={{ minHeight: "600px" }}>
                    <iframe
                      ref={iframeRef}
                      title="Email Preview"
                      className="w-full border-0"
                      style={{ height: "600px" }}
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmailEditor
              initialBlocks={editorBlocks}
              onChange={handleEditorChange}
            />
          )}
        </div>
      </div>

      {/* ── Footer (pinned) ────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-end gap-3 px-6 lg:px-8 py-3 border-t bg-background">
        <Link href="/templates" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}>Cancel</Link>
        <Button onClick={handleSave} disabled={saving} size="sm" className="h-9">
          {saving ? "Saving..." : "Save Template"}
        </Button>
      </div>
    </div>
  );
}

export default function NewTemplatePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
      <NewTemplateContent />
    </Suspense>
  );
}
