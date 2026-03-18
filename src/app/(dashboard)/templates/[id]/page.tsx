"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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

interface Template {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  jsonContent: string;
}

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
        if (t.jsonContent) {
          try {
            setEditorBlocks(JSON.parse(t.jsonContent));
          } catch {
            setEditorBlocks([]);
          }
        }
      } catch {
        toast.error("Failed to load template");
      } finally {
        setLoading(false);
      }
    }
    fetchTemplate();
  }, [templateId, router]);

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
        body: JSON.stringify({ name, subject, htmlContent, jsonContent }),
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
          <CardTitle>Email Content</CardTitle>
          <CardDescription>
            Edit your email template
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailEditor
            initialBlocks={editorBlocks}
            onChange={handleEditorChange}
          />
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
