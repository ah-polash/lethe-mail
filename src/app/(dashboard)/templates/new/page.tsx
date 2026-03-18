"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Loader2, Code, Blocks, Eye, EyeOff } from "lucide-react";
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
import { EmailEditor, type EmailBlock } from "@/components/email-editor/editor";
import { toast } from "sonner";

function NewTemplateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAI = searchParams.get("ai") === "true";

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
        body: JSON.stringify({ prompt: aiPrompt, style: aiStyle }),
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
          <h1 className="text-xl font-semibold">New Template</h1>
        </div>
        <div className="flex items-center gap-2">
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
                    <Button onClick={handleGenerateAI} disabled={generating} size="sm" className="h-9">
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
