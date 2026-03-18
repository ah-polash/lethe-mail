"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Loader2, Code, Blocks, Eye, EyeOff, History, Upload, X, Plus, Trash2, Package } from "lucide-react";
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
  aiMode: string;
  createdAt: string;
}

interface FeatureItem {
  id: string;
  imageUrl: string;
  caption: string;
  uploading: boolean;
}

function NewTemplateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aiMode = searchParams.get("ai"); // "true" | "product-update" | null
  const showAI = aiMode === "true";
  const isProductUpdateMode = aiMode === "product-update";

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
      const mode = aiMode || "true";
      const res = await fetch(`/api/ai-prompts?aiMode=${encodeURIComponent(mode)}`);
      if (res.ok) {
        const data = await res.json();
        setSavedPrompts(data.prompts || []);
      }
    } catch { /* ignore */ }
    finally { setPromptsLoading(false); }
  };

  // Product Update mode
  const [productName, setProductName] = useState("");
  const [landingPageUrl, setLandingPageUrl] = useState("");
  const [pricingPageUrl, setPricingPageUrl] = useState("");
  const [versionNumber, setVersionNumber] = useState("");
  const [features, setFeatures] = useState<FeatureItem[]>([
    { id: crypto.randomUUID(), imageUrl: "", caption: "", uploading: false },
  ]);
  const [productInstruction, setProductInstruction] = useState("");

  const addFeature = () => {
    setFeatures((prev) => [...prev, { id: crypto.randomUUID(), imageUrl: "", caption: "", uploading: false }]);
  };

  const removeFeature = (id: string) => {
    setFeatures((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFeatureCaption = (id: string, caption: string) => {
    setFeatures((prev) => prev.map((f) => f.id === id ? { ...f, caption } : f));
  };

  const handleFeatureImageUpload = async (id: string, file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Only image files are allowed"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10MB"); return; }

    setFeatures((prev) => prev.map((f) => f.id === id ? { ...f, uploading: true } : f));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setFeatures((prev) => prev.map((f) => f.id === id ? { ...f, imageUrl: data.url, uploading: false } : f));
      } else {
        const data = await res.json();
        toast.error(data.error || "Upload failed");
        setFeatures((prev) => prev.map((f) => f.id === id ? { ...f, uploading: false } : f));
      }
    } catch {
      toast.error("Upload failed");
      setFeatures((prev) => prev.map((f) => f.id === id ? { ...f, uploading: false } : f));
    }
  };

  const handleGenerateProductUpdate = async () => {
    if (!productName) { toast.error("Product name is required"); return; }
    if (!landingPageUrl) { toast.error("Landing page URL is required"); return; }
    if (!pricingPageUrl) { toast.error("Pricing page URL is required"); return; }
    if (!versionNumber) { toast.error("Version number is required"); return; }

    const validFeatures = features.filter((f) => f.imageUrl && f.caption);
    if (validFeatures.length === 0) {
      toast.error("At least one feature with image and caption is required");
      return;
    }

    setGenerating(true);
    try {
      const featuresDescription = validFeatures
        .map((f, i) => `Feature ${i + 1}: "${f.caption}" (screenshot: ${f.imageUrl})`)
        .join("\n");

      const prompt = `Generate a product feature update email for "${productName}" version ${versionNumber}.

Product landing page: ${landingPageUrl}
Pricing page: ${pricingPageUrl}

Features to highlight (each has a screenshot that MUST be included as an <img> tag in the email):
${featuresDescription}

${productInstruction ? `Additional instructions: ${productInstruction}` : ""}

Requirements:
- The email should have a professional header with the product name and version number
- Each feature MUST be displayed as a section with:
  1. The screenshot image (<img src="..." width="100%" style="max-width:560px;border:1px solid #e5e7eb;border-radius:8px;" />)
  2. A compelling feature title derived from the caption
  3. A brief description explaining the feature benefit (2-3 sentences)
- Include a CTA button linking to ${landingPageUrl} (e.g. "Explore ${productName} ${versionNumber}")
- Include a secondary link to the pricing page ${pricingPageUrl}
- Use inline styles for email compatibility
- Make it responsive and modern looking`;

      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: "professional",
          templateName: `${productName} v${versionNumber} Update`,
          templateSubject: `${productName} v${versionNumber} — New Features`,
          aiMode: "product-update",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setHtmlContent(data.html || "");
        setJsonContent("");
        setEditorBlocks([]);
        setIsHtmlMode(true);
        if (data.subject) setSubject(data.subject);
        setName(`${productName} v${versionNumber} Update`);
        toast.success("Product update email generated!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to generate");
      }
    } catch {
      toast.error("Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  const applyPrompt = (p: SavedPrompt) => {
    if (isProductUpdateMode) {
      // Parse product update details from the saved prompt
      const productMatch = p.prompt.match(/for "([^"]+)" version ([^\s.]+(?:\.\S*)?)/);
      if (productMatch) {
        setProductName(productMatch[1]);
        setVersionNumber(productMatch[2]);
      }
      const landingMatch = p.prompt.match(/Product landing page:\s*(\S+)/);
      if (landingMatch) setLandingPageUrl(landingMatch[1]);
      const pricingMatch = p.prompt.match(/Pricing page:\s*(\S+)/);
      if (pricingMatch) setPricingPageUrl(pricingMatch[1]);

      // Extract features
      const featureMatches = [...p.prompt.matchAll(/Feature \d+:\s*"([^"]+)"\s*\(screenshot:\s*(\S+)\)/g)];
      if (featureMatches.length > 0) {
        setFeatures(featureMatches.map((m) => ({
          id: crypto.randomUUID(),
          caption: m[1],
          imageUrl: m[2],
          uploading: false,
        })));
      }

      // Extract additional instructions
      const instructionMatch = p.prompt.match(/Additional instructions:\s*([\s\S]+?)(?:\n\nRequirements:|$)/);
      if (instructionMatch) setProductInstruction(instructionMatch[1].trim());
    } else {
      setAiPrompt(p.prompt);
      setAiStyle(p.style || "professional");
      if (p.name) setName(p.name);
      if (p.subject) setSubject(p.subject);
    }
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
    if (!aiPrompt) {
      toast.error("Please enter a prompt");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          style: aiStyle,
          templateName: name,
          templateSubject: subject,
          aiMode: aiMode || "true",
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
            {isProductUpdateMode ? "Product Feature Update" : "New Template"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {(showAI || isProductUpdateMode) && (
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
          {/* Template Details – slim inline row (hidden in product update mode until generated) */}
          {!isProductUpdateMode && (
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
          )}

          {/* Product Update Mode */}
          {isProductUpdateMode && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4" />
                  Product Feature Update Generator
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Product Name <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. Acme App"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>New Version Number <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. 2.5.0"
                      value={versionNumber}
                      onChange={(e) => setVersionNumber(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Product Landing Page URL <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="https://example.com"
                      value={landingPageUrl}
                      onChange={(e) => setLandingPageUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Product Pricing Page URL <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="https://example.com/pricing"
                      value={pricingPageUrl}
                      onChange={(e) => setPricingPageUrl(e.target.value)}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Features <span className="text-destructive">*</span></Label>
                    <Button type="button" variant="outline" size="sm" onClick={addFeature} className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Add Feature
                    </Button>
                  </div>

                  {features.map((feature, index) => (
                    <div key={feature.id} className="border p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Feature {index + 1}</span>
                        {features.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeFeature(feature.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>

                      {/* Feature image upload */}
                      {feature.imageUrl ? (
                        <div className="relative inline-block">
                          <img
                            src={feature.imageUrl}
                            alt={`Feature ${index + 1}`}
                            className="max-h-[140px] border object-contain bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setFeatures((prev) => prev.map((f) => f.id === feature.id ? { ...f, imageUrl: "" } : f))}
                            className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center bg-destructive text-white text-xs hover:bg-destructive/90 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFeatureImageUpload(feature.id, file);
                              e.target.value = "";
                            }}
                          />
                          {feature.uploading ? (
                            <>
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-5 w-5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Click to upload screenshot</span>
                            </>
                          )}
                        </label>
                      )}

                      {/* Feature caption */}
                      <Input
                        placeholder="Feature caption — e.g. New dashboard with real-time analytics"
                        value={feature.caption}
                        onChange={(e) => updateFeatureCaption(feature.id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label>Additional Instructions (optional)</Label>
                  <Textarea
                    placeholder="Any extra instructions for the AI, e.g. tone, colors, branding guidelines..."
                    value={productInstruction}
                    onChange={(e) => setProductInstruction(e.target.value)}
                    rows={2}
                  />
                </div>

                <Button
                  onClick={handleGenerateProductUpdate}
                  disabled={generating}
                  className="w-full"
                >
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {generating ? "Generating..." : "Generate product update email"}
                </Button>
              </div>

              {/* Show auto-filled name/subject after generation */}
              {(name || subject) && (
                <>
                  <Separator />
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
                </>
              )}
            </>
          )}

          {/* AI Generation */}
          {showAI && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  AI Template Generator
                </div>

                <div className="flex items-start gap-3">
                  <Textarea
                    id="ai-prompt"
                    placeholder="e.g. A welcome email for new SaaS subscribers with a CTA to start their free trial"
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
                      disabled={generating || !aiPrompt}
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
