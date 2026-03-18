"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Code, Blocks, Eye, EyeOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmailEditor, type EmailBlock } from "@/components/email-editor/editor";
import { toast } from "sonner";

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [jsonContent, setJsonContent] = useState("");
  const [editorBlocks, setEditorBlocks] = useState<EmailBlock[]>([]);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    async function fetchTemplate() {
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        if (!res.ok) {
          toast.error("Template not found");
          router.push("/templates");
          return;
        }
        const data = await res.json();
        const t = data.template;
        setName(t.name);
        setSubject(t.subject || "");
        setHtmlContent(t.htmlContent || "");
        setJsonContent(t.jsonContent || "");

        // If template has jsonContent, use block editor; otherwise use HTML mode
        if (t.jsonContent) {
          try {
            setEditorBlocks(JSON.parse(t.jsonContent));
            setIsHtmlMode(false);
          } catch {
            setEditorBlocks([]);
            setIsHtmlMode(true);
          }
        } else {
          setIsHtmlMode(true);
        }
      } catch {
        toast.error("Failed to load template");
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();
  }, [templateId, router]);

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

  const handleSave = async () => {
    if (!name) {
      toast.error("Template name is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          htmlContent,
          jsonContent: isHtmlMode ? "" : jsonContent,
        }),
      });

      if (res.ok) {
        toast.success("Template updated");
      } else {
        toast.error("Failed to update template");
      }
    } catch {
      toast.error("Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading template...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/templates" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
            <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Edit Template</h2>
          <p className="text-muted-foreground">
            Update your email template
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Default Subject Line</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Email Content</CardTitle>
              <CardDescription>
                {isHtmlMode ? "Edit raw HTML" : "Edit your email template"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isHtmlMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
                  {showPreview ? "Hide Preview" : "Show Preview"}
                </Button>
              )}
              {jsonContent && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsHtmlMode(!isHtmlMode)}
                >
                  {isHtmlMode ? <Blocks className="h-4 w-4 mr-1.5" /> : <Code className="h-4 w-4 mr-1.5" />}
                  {isHtmlMode ? "Block Editor" : "HTML Editor"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isHtmlMode ? (
            <div className={`grid gap-4 ${showPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
              <div className="space-y-2">
                <Label>HTML Code</Label>
                <textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full min-h-[500px] font-mono text-sm p-4 rounded-lg border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  spellCheck={false}
                />
              </div>
              {showPreview && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="border rounded-lg overflow-hidden bg-white" style={{ minHeight: "500px" }}>
                    <iframe
                      ref={iframeRef}
                      title="Email Preview"
                      className="w-full border-0"
                      style={{ height: "500px" }}
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
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href="/templates" className={cn(buttonVariants({ variant: "outline" }))}>Cancel</Link>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Template"}
        </Button>
      </div>
    </div>
  );
}
