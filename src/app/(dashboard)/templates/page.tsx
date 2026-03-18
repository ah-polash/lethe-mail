"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Sparkles, Package, Trash2, FileText, LayoutGrid, Columns2, Columns3 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [cols, setCols] = useState<1 | 2 | 3>(3);

  useEffect(() => {
    const saved = localStorage.getItem("templates-grid-cols");
    if (saved === "1" || saved === "2" || saved === "3") setCols(Number(saved) as 1 | 2 | 3);
  }, []);

  const updateCols = (n: 1 | 2 | 3) => {
    setCols(n);
    localStorage.setItem("templates-grid-cols", String(n));
  };

  const gridClass = cols === 1 ? "grid-cols-1" : cols === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Template deleted");
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        toast.error("Failed to delete template");
      }
    } catch {
      toast.error("Failed to delete template");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Templates</h2>
          <p className="text-muted-foreground">
            Manage your email templates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border divide-x">
            {([1, 2, 3] as const).map((n) => (
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
              </button>
            ))}
          </div>
          <Link href="/templates/new?ai=product-update" className={cn(buttonVariants({ variant: "outline" }))}>
              <Package className="mr-2 h-4 w-4" />
              Product Feature Update
          </Link>
<Link href="/templates/new?ai=true" className={cn(buttonVariants({ variant: "outline" }))}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate with AI
          </Link>
          <Link href="/templates/new" className={cn(buttonVariants())}>
              <Plus className="mr-2 h-4 w-4" />
              New Template
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">
          Loading templates...
        </p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              No templates yet. Create your first template.
            </p>
            <Link href="/templates/new" className={cn(buttonVariants())}>Create Template</Link>
          </CardContent>
        </Card>
      ) : (
        <div className={cn("grid gap-4", gridClass)}>
          {templates.map((template) => (
            cols === 1 ? (
              <Card key={template.id} className="group relative overflow-hidden">
                {/* Info bar on top */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
                  <div className="min-w-0 flex-1 mr-4">
                    <Link href={`/templates/${template.id}`} className="font-semibold text-base hover:underline truncate block">
                      {template.name}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">{template.subject || "No subject"} &middot; {new Date(template.updatedAt || template.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link href={`/templates/${template.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Edit</Link>
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Template</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete &quot;{template.name}&quot;? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(template.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {/* Full-size email preview */}
                <div className="bg-white overflow-auto" style={{ height: "calc(100vh - 220px)" }}>
                  {template.htmlContent ? (
                    <div
                      className="pointer-events-none"
                      dangerouslySetInnerHTML={{ __html: template.htmlContent }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No preview</div>
                  )}
                </div>
              </Card>
            ) : (
              <Card key={template.id} className="group relative">
                <div>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg truncate">
                    <Link href={`/templates/${template.id}`} className="hover:underline">{template.name}</Link>
                  </CardTitle>
                  <CardDescription className="truncate">{template.subject || "No subject"}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border bg-white p-2 h-40 overflow-hidden mb-3">
                    {template.htmlContent ? (
                      <div
                        className="transform scale-[0.25] origin-top-left w-[400%] h-[400%] pointer-events-none"
                        dangerouslySetInnerHTML={{ __html: template.htmlContent }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No preview</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {new Date(template.updatedAt || template.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex gap-1">
                      <Link href={`/templates/${template.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Edit</Link>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Template</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;{template.name}&quot;? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(template.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
                </div>
              </Card>
            )
          ))}
        </div>
      )}
    </div>
  );
}
