"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
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

  // AI Generation
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("professional");
  const [generating, setGenerating] = useState(false);
  const [editorBlocks, setEditorBlocks] = useState<EmailBlock[]>([]);

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
        setHtmlContent(data.htmlContent || "");
        setJsonContent(data.jsonContent || "");
        if (data.jsonContent) {
          try {
            setEditorBlocks(JSON.parse(data.jsonContent));
          } catch {
            setEditorBlocks([]);
          }
        }
        if (data.subject) setSubject(data.subject);
        if (data.name) setName(data.name);
        toast.success("Template generated! You can edit it below.");
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

    setSaving(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, htmlContent, jsonContent }),
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
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {generating ? "Generating..." : "Generate"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Email Editor */}
          <EmailEditor
            initialBlocks={editorBlocks}
            onChange={handleEditorChange}
          />
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
