"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { html_beautify } from "js-beautify";
import { EmailEditor, type EmailBlock, type DynamicField } from "@/components/email-editor/editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Globe,
  CalendarClock,
  Sparkles,
  Package,
  History,
  Plus,
  Trash2,
  Upload,
  X,
  Code,
  Blocks,
  Eye,
  EyeOff,
  Wand2,
  Download,
  UserCog,
  RotateCcw,
  UserSearch,
  Star,
  Save,
  ArrowDownToLine,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SavedPrompt {
  id: string;
  prompt: string;
  style: string;
  name: string | null;
  subject: string | null;
  aiMode: string;
  createdAt: string;
}

interface DynamicTemplateRow {
  id: string;
  name: string;
  subject: string | null;
  htmlContent: string;
  source: string; // "manual" | "ai"
  aiMode: string | null;
  prompt: string | null;
  createdAt: string;
}

interface FeatureItem {
  id: string;
  imageUrl: string;
  caption: string;
  uploading: boolean;
}

type AiPanel = "none" | "regular" | "product-update";

interface SesIdentity {
  identity: string;
  type: string;
  verified: boolean;
}

interface Segment {
  _id: string;
  name: string;
}

export default function SwipeOneCampaignPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [sending, setSending] = useState(false);

  // Details
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [identities, setIdentities] = useState<SesIdentity[]>([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(false);

  // SwipeOne segments
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);

  // SwipeOne dynamic fields
  const [swipeOneFields, setSwipeOneFields] = useState<DynamicField[]>([]);
  const [swipeOneFieldsLoading, setSwipeOneFieldsLoading] = useState(false);

  // Popular variables (pinned in Settings)
  const [popularVarNames, setPopularVarNames] = useState<string[]>([]);

  // Content
  const [htmlContent, setHtmlContent] = useState("");
  const [jsonContent, setJsonContent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Dynamic templates library (used for "Load from Template")
  const [dynamicLibrary, setDynamicLibrary] = useState<DynamicTemplateRow[]>([]);
  const [dynamicLibraryLoading, setDynamicLibraryLoading] = useState(false);
  const [libraryPreview, setLibraryPreview] = useState<DynamicTemplateRow | null>(null);
  const [editorBlocks, setEditorBlocks] = useState<EmailBlock[]>([]);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [showHtmlPreview, setShowHtmlPreview] = useState(true);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  // Variable mapper (preview exact)
  const [varMapOpen, setVarMapOpen] = useState(false);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  // When mappedHtml is set, the preview iframe renders it instead of htmlContent.
  const [mappedHtml, setMappedHtml] = useState<string | null>(null);

  // Smart map-variables modal (large)
  const [mapVarsOpen, setMapVarsOpen] = useState(false);
  const codeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [codePos, setCodePos] = useState<{ start: number; end: number; text: string }>({
    start: 0,
    end: 0,
    text: "",
  });
  const [customVarName, setCustomVarName] = useState("");

  // SwipeOne contact mapper
  const [contactMapOpen, setContactMapOpen] = useState(false);
  const [contactMapSegmentId, setContactMapSegmentId] = useState<string>("");
  const [contactMapContacts, setContactMapContacts] = useState<Record<string, unknown>[]>([]);
  const [contactMapLoading, setContactMapLoading] = useState(false);
  const [contactMapSearch, setContactMapSearch] = useState("");
  const [mappedContactLabel, setMappedContactLabel] = useState<string | null>(null);

  // AI generation
  const [aiPanel, setAiPanel] = useState<AiPanel>("none");
  const [generating, setGenerating] = useState(false);

  // Regular AI prompt
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("professional");

  // Product update fields
  const [productName, setProductName] = useState("");
  const [landingPageUrl, setLandingPageUrl] = useState("");
  const [pricingPageUrl, setPricingPageUrl] = useState("");
  const [versionNumber, setVersionNumber] = useState("");
  const [productInstruction, setProductInstruction] = useState("");
  const [features, setFeatures] = useState<FeatureItem[]>([
    { id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()), imageUrl: "", caption: "", uploading: false },
  ]);

  // Saved prompts (per panel — fetched on demand by aiMode)
  const [regularPrompts, setRegularPrompts] = useState<SavedPrompt[]>([]);
  const [regularPromptsLoading, setRegularPromptsLoading] = useState(false);
  const [regularPromptsOpen, setRegularPromptsOpen] = useState(false);

  const [productPrompts, setProductPrompts] = useState<SavedPrompt[]>([]);
  const [productPromptsLoading, setProductPromptsLoading] = useState(false);
  const [productPromptsOpen, setProductPromptsOpen] = useState(false);

  // Saved AI results / Dynamic Templates (per panel)
  const [regularResults, setRegularResults] = useState<DynamicTemplateRow[]>([]);
  const [regularResultsLoading, setRegularResultsLoading] = useState(false);
  const [regularResultsOpen, setRegularResultsOpen] = useState(false);

  const [productResults, setProductResults] = useState<DynamicTemplateRow[]>([]);
  const [productResultsLoading, setProductResultsLoading] = useState(false);
  const [productResultsOpen, setProductResultsOpen] = useState(false);

  // Save As Dynamic Template dialog
  const [saveDynamicOpen, setSaveDynamicOpen] = useState(false);
  const [saveDynamicName, setSaveDynamicName] = useState("");
  const [saveDynamicSubject, setSaveDynamicSubject] = useState("");
  const [savingDynamic, setSavingDynamic] = useState(false);

  // Schedule
  const [scheduledAt, setScheduledAt] = useState<string>("");

  // User role
  const [userRole, setUserRole] = useState<string>("");

  const loadSegments = useCallback(async () => {
    setSegmentsLoading(true);
    try {
      const res = await fetch("/api/swipeone/segments");
      if (res.ok) {
        const data = await res.json();
        setSegments(data.segments || []);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to load segments");
      }
    } catch {
      toast.error("Failed to load segments. Check SwipeOne configuration.");
    } finally {
      setSegmentsLoading(false);
    }
  }, []);

  const loadSwipeOneFields = useCallback(async () => {
    setSwipeOneFieldsLoading(true);
    try {
      const res = await fetch("/api/swipeone/fields");
      if (res.ok) {
        const data = await res.json();
        setSwipeOneFields(data.fields || []);
      }
    } catch {
      // optional
    } finally {
      setSwipeOneFieldsLoading(false);
    }
  }, []);

  const loadPopularVariables = useCallback(async () => {
    try {
      const res = await fetch("/api/swipeone/popular-variables");
      if (res.ok) {
        const data = await res.json();
        const names = (data.variables || [])
          .map((v: { name: string }) => v.name)
          .filter(Boolean);
        setPopularVarNames(names);
      }
    } catch {
      // optional
    }
  }, []);

  const loadDynamicLibrary = useCallback(async () => {
    setDynamicLibraryLoading(true);
    try {
      const res = await fetch("/api/dynamic-templates");
      if (res.ok) {
        const data = await res.json();
        setDynamicLibrary((data.templates || []) as DynamicTemplateRow[]);
      }
    } catch {
      // optional
    } finally {
      setDynamicLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUserRole(d.user?.role || ""))
      .catch(() => {});

    loadDynamicLibrary();

    setIdentitiesLoading(true);
    fetch("/api/ses/identities")
      .then((r) => r.json())
      .then((d) => {
        const emailOnly = (d.identities || []).filter(
          (i: SesIdentity) => i.verified && i.type === "EMAIL_ADDRESS"
        );
        setIdentities(emailOnly);
      })
      .catch(() => {})
      .finally(() => setIdentitiesLoading(false));

    loadSegments();
    loadSwipeOneFields();
    loadPopularVariables();
  }, [loadSegments, loadSwipeOneFields, loadPopularVariables, loadDynamicLibrary]);

  // Refresh popular variables whenever the Map Variables modal opens, so
  // changes from Settings appear without a full page reload.
  useEffect(() => {
    if (mapVarsOpen) loadPopularVariables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapVarsOpen]);

  // Field list sorted with popular variables first.
  const sortedSwipeOneFields = (() => {
    if (popularVarNames.length === 0) return swipeOneFields;
    const popularSet = new Set(popularVarNames);
    const popular: DynamicField[] = [];
    const rest: DynamicField[] = [];
    // Preserve the explicit ordering of popular variables from Settings.
    const byName = new Map<string, DynamicField>();
    for (const f of swipeOneFields) byName.set(f.name, f);
    for (const name of popularVarNames) {
      const found = byName.get(name);
      if (found) popular.push(found);
      else popular.push({ name, label: name });
    }
    for (const f of swipeOneFields) {
      if (!popularSet.has(f.name)) rest.push(f);
    }
    return [...popular, ...rest];
  })();

  const fetchSavedPrompts = useCallback(async (mode: "true" | "product-update") => {
    if (mode === "true") setRegularPromptsLoading(true);
    else setProductPromptsLoading(true);
    try {
      const res = await fetch(`/api/ai-prompts?aiMode=${encodeURIComponent(mode)}`);
      if (res.ok) {
        const data = await res.json();
        if (mode === "true") setRegularPrompts(data.prompts || []);
        else setProductPrompts(data.prompts || []);
      }
    } catch {
      // ignore
    } finally {
      if (mode === "true") setRegularPromptsLoading(false);
      else setProductPromptsLoading(false);
    }
  }, []);

  // Build the variable-hint block appended to AI prompts so generated HTML uses
  // SwipeOne field names as {{name}} placeholders.
  const buildVariableHint = useCallback((): string => {
    if (swipeOneFields.length === 0) return "";
    const list = swipeOneFields
      .slice(0, 40) // cap to keep prompt size sane
      .map((f) => `- {{${f.name}}}${f.label && f.label !== f.name ? ` — ${f.label}` : ""}`)
      .join("\n");
    return `

Personalization: Include relevant SwipeOne contact variables as Handlebars-style placeholders (e.g. greetings like "Hi {{firstName}},"). Available variables:
${list}

Only use these exact variable names. Place them where they make sense — at minimum, use {{firstName}} or {{fullName}} in the greeting if available.`;
  }, [swipeOneFields]);

  const applyPrompt = (p: SavedPrompt) => {
    if (p.aiMode === "product-update") {
      const productMatch = p.prompt.match(/for "([^"]+)" version ([^\s.]+(?:\.\S*)?)/);
      if (productMatch) {
        setProductName(productMatch[1]);
        setVersionNumber(productMatch[2]);
      }
      const landingMatch = p.prompt.match(/Product landing page:\s*(\S+)/);
      if (landingMatch) setLandingPageUrl(landingMatch[1]);
      const pricingMatch = p.prompt.match(/Pricing page:\s*(\S+)/);
      if (pricingMatch) setPricingPageUrl(pricingMatch[1]);
      const featureMatches = [...p.prompt.matchAll(/Feature \d+:\s*"([^"]+)"\s*\(screenshot:\s*(\S+)\)/g)];
      if (featureMatches.length > 0) {
        setFeatures(
          featureMatches.map((m) => ({
            id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
            caption: m[1],
            imageUrl: m[2],
            uploading: false,
          }))
        );
      }
      const instructionMatch = p.prompt.match(/Additional instructions:\s*([\s\S]+?)(?:\n\nRequirements:|$)/);
      if (instructionMatch) setProductInstruction(instructionMatch[1].trim());
      setAiPanel("product-update");
      setProductPromptsOpen(false);
    } else {
      setAiPrompt(p.prompt);
      setAiStyle(p.style || "professional");
      if (p.name && !name) setName(p.name);
      if (p.subject && !subject) setSubject(p.subject);
      setAiPanel("regular");
      setRegularPromptsOpen(false);
    }
    toast.success("Prompt loaded — click Generate.");
  };

  const addFeature = () => {
    setFeatures((prev) => [
      ...prev,
      { id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()), imageUrl: "", caption: "", uploading: false },
    ]);
  };

  const removeFeature = (id: string) => {
    setFeatures((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFeatureCaption = (id: string, caption: string) => {
    setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, caption } : f)));
  };

  const handleFeatureImageUpload = async (id: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, uploading: true } : f)));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, imageUrl: data.url, uploading: false } : f)));
      } else {
        const data = await res.json();
        toast.error(data.error || "Upload failed");
        setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, uploading: false } : f)));
      }
    } catch {
      toast.error("Upload failed");
      setFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, uploading: false } : f)));
    }
  };

  const applyGenerated = (html: string, generatedSubject?: string, fallbackName?: string) => {
    setHtmlContent(html);
    setJsonContent("");
    setEditorBlocks([]);
    setIsHtmlMode(true);
    if (generatedSubject && !subject) setSubject(generatedSubject);
    if (fallbackName && !name) setName(fallbackName);
  };

  // Apply a saved DynamicTemplate to the editor.
  const applyDynamicTemplate = (t: DynamicTemplateRow) => {
    applyGenerated(t.htmlContent, t.subject || undefined, t.name || undefined);
    toast.success(`Loaded "${t.name}" — no tokens used`);
  };

  // Best-effort guess of which AI mode this template belongs to, used when
  // saving from the Map Variables modal.
  const inferAiMode = (): "product-update" | "true" =>
    aiPanel === "product-update" ? "product-update" : "true";

  const openSaveDynamic = () => {
    if (!htmlContent.trim()) {
      toast.error("No HTML to save");
      return;
    }
    setSaveDynamicName(name || subject || `Template — ${new Date().toLocaleString()}`);
    setSaveDynamicSubject(subject || "");
    setSaveDynamicOpen(true);
  };

  const handleSaveDynamicTemplate = async () => {
    const tplName = saveDynamicName.trim();
    if (!tplName) {
      toast.error("Template name is required");
      return;
    }
    setSavingDynamic(true);
    try {
      const res = await fetch("/api/dynamic-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tplName,
          subject: saveDynamicSubject.trim() || null,
          htmlContent,
          source: "manual",
          aiMode: inferAiMode(),
        }),
      });
      if (res.ok) {
        toast.success(`Saved "${tplName}" as Dynamic Template`);
        setSaveDynamicOpen(false);
        // Refresh both result lists so the new entry shows up immediately
        fetchPreviousResults("true");
        fetchPreviousResults("product-update");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to save template");
      }
    } catch {
      toast.error("Failed to save template");
    } finally {
      setSavingDynamic(false);
    }
  };

  const fetchPreviousResults = useCallback(
    async (mode: "true" | "product-update") => {
      if (mode === "true") setRegularResultsLoading(true);
      else setProductResultsLoading(true);
      try {
        const res = await fetch(`/api/dynamic-templates?aiMode=${encodeURIComponent(mode)}`);
        if (res.ok) {
          const data = await res.json();
          const list = (data.templates || []) as DynamicTemplateRow[];
          if (mode === "true") setRegularResults(list);
          else setProductResults(list);
        }
      } catch {
        // ignore
      } finally {
        if (mode === "true") setRegularResultsLoading(false);
        else setProductResultsLoading(false);
      }
    },
    []
  );

  const handleGenerateRegular = async () => {
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
          prompt: aiPrompt + buildVariableHint(),
          style: aiStyle,
          templateName: name,
          templateSubject: subject,
          aiMode: "true",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        applyGenerated(data.html || "", data.subject);
        toast.success("Email generated! Review the HTML or switch to block editor.");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to generate email");
      }
    } catch {
      toast.error("Failed to generate email");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateProductUpdate = async () => {
    if (!productName) { toast.error("Product name is required"); return; }
    if (!landingPageUrl) { toast.error("Landing page URL is required"); return; }
    if (!pricingPageUrl) { toast.error("Pricing page URL is required"); return; }
    if (!versionNumber) { toast.error("Version number is required"); return; }

    const validFeatures = features.filter((f) => f.imageUrl && f.caption);
    if (validFeatures.length === 0) {
      toast.error("Add at least one feature with image and caption");
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
- Make it responsive and modern looking${buildVariableHint()}`;

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
        applyGenerated(data.html || "", data.subject, `${productName} v${versionNumber} Update`);
        toast.success("Product update email generated!");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to generate");
      }
    } catch {
      toast.error("Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  // Sync HTML preview iframe (mapped values take precedence over raw HTML)
  useEffect(() => {
    if (isHtmlMode && showHtmlPreview && previewIframeRef.current) {
      const doc = previewIframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(mappedHtml ?? htmlContent);
        doc.close();
      }
    }
  }, [htmlContent, mappedHtml, isHtmlMode, showHtmlPreview]);

  // If the user edits HTML, drop the mapped preview so it doesn't go stale.
  useEffect(() => {
    if (mappedHtml !== null) setMappedHtml(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [htmlContent]);

  const formatHtml = () => {
    if (!htmlContent.trim()) {
      toast.error("No HTML to format");
      return;
    }
    try {
      const formatted = html_beautify(htmlContent, {
        indent_size: 2,
        wrap_line_length: 120,
        preserve_newlines: true,
        max_preserve_newlines: 1,
        end_with_newline: true,
        unformatted: ["pre", "code"],
        content_unformatted: ["pre", "textarea"],
        extra_liners: [],
      });
      setHtmlContent(formatted);
      toast.success("HTML formatted");
    } catch {
      toast.error("Failed to format HTML");
    }
  };

  const downloadHtml = () => {
    if (!htmlContent.trim()) {
      toast.error("No HTML to download");
      return;
    }
    const safeName = (name || "email-template")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "email-template";
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Detect every {{var}} placeholder in the current HTML — distinct names + occurrence counts
  const usedVars = (() => {
    const counts = new Map<string, number>();
    const re = /\{\{\s*([\w.]+)\s*\}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(htmlContent)) !== null) {
      const name = m[1];
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  })();
  const detectedVars = usedVars.map((v) => v.name);
  const totalVarOccurrences = usedVars.reduce((s, v) => s + v.count, 0);


  const openVarMapper = () => {
    if (detectedVars.length === 0) {
      toast.error("No {{variable}} placeholders found in this email");
      return;
    }
    // Pre-fill any vars that don't yet have a value with sensible samples
    const next: Record<string, string> = { ...varValues };
    for (const v of detectedVars) {
      if (!(v in next)) {
        const lc = v.toLowerCase();
        next[v] =
          lc === "email" ? "jane@example.com" :
          lc === "firstname" ? "Jane" :
          lc === "lastname" ? "Doe" :
          lc === "fullname" ? "Jane Doe" :
          "";
      }
    }
    setVarValues(next);
    setVarMapOpen(true);
  };

  const applyVarMapping = () => {
    const replaced = htmlContent.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
      const v = varValues[key];
      return v !== undefined && v !== "" ? v : `{{${key}}}`;
    });
    setMappedHtml(replaced);
    setVarMapOpen(false);
    toast.success("Preview updated with mapped values");
  };

  const clearMapping = () => {
    setMappedHtml(null);
    setMappedContactLabel(null);
    toast.success("Mapping cleared — showing raw template");
  };

  const openMapVars = () => {
    if (usedVars.length === 0) {
      toast.error("No {{variable}} placeholders found in this email");
      return;
    }
    // Pre-fill missing values with empties so inputs are controlled
    const next: Record<string, string> = { ...varValues };
    for (const { name } of usedVars) {
      if (!(name in next)) next[name] = "";
    }
    setVarValues(next);
    setMapVarsOpen(true);
  };

  const fillSampleDefaults = () => {
    setVarValues((prev) => {
      const next = { ...prev };
      for (const { name } of usedVars) {
        if (next[name]) continue;
        const lc = name.toLowerCase();
        next[name] =
          lc === "email" ? "jane@example.com" :
          lc === "firstname" || lc === "first_name" ? "Jane" :
          lc === "lastname" || lc === "last_name" ? "Doe" :
          lc === "fullname" || lc === "full_name" ? "Jane Doe" :
          lc === "phone" || lc === "phonenumber" || lc === "phone_number" ? "+1 555-0100" :
          lc === "country" ? "United States" :
          lc === "city" ? "San Francisco" :
          lc === "company" || lc === "companyname" || lc === "organization" ? "Acme Inc." :
          lc === "jobtitle" || lc === "job_title" ? "Product Manager" :
          lc === "tags" ? "vip, customer" :
          lc === "language" ? "en" :
          lc === "timezone" ? "America/Los_Angeles" :
          `Sample ${name}`;
      }
      return next;
    });
    toast.success("Sample defaults applied — review and adjust");
  };

  const scrollToVar = (name: string) => {
    const ta = codeTextareaRef.current;
    if (!ta) return;
    const re = new RegExp(`\\{\\{\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`);
    const match = re.exec(htmlContent);
    if (!match) return;
    const start = match.index;
    const end = start + match[0].length;
    ta.focus();
    ta.setSelectionRange(start, end);
    // Approximate scroll: scrollTop based on the line index of the match
    const lineIndex = htmlContent.slice(0, start).split("\n").length - 1;
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight || "16") || 16;
    ta.scrollTop = Math.max(0, lineIndex * lineHeight - ta.clientHeight / 2);
  };

  const captureCodePos = () => {
    const el = codeTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setCodePos({ start, end, text: htmlContent.slice(start, end) });
  };

  const hasSelection = codePos.start !== codePos.end;

  const insertVariable = (varName: string) => {
    const cleanName = varName.trim().replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "");
    if (!cleanName) {
      toast.error("Variable name is required");
      return;
    }
    if (!/^[\w.]+$/.test(cleanName)) {
      toast.error("Variable name can only contain letters, numbers, _ or .");
      return;
    }
    const { start, end } = codePos;
    const tag = `{{${cleanName}}}`;
    const next = htmlContent.slice(0, start) + tag + htmlContent.slice(end);
    setHtmlContent(next);
    const cursor = start + tag.length;
    setCodePos({ start: cursor, end: cursor, text: "" });
    setCustomVarName("");
    toast.success(start === end ? `Inserted ${tag}` : `Replaced selection with ${tag}`);
    setTimeout(() => {
      const el = codeTextareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(cursor, cursor);
      }
    }, 0);
  };

  const applyMapVars = () => {
    applyVarMapping();
    setMapVarsOpen(false);
  };

  // Flatten a SwipeOne contact record into a single key→value map for merge tags.
  // Custom fields can live under `properties` as JSON; merge those in too.
  const flattenContact = (c: Record<string, unknown>): Record<string, unknown> => {
    const { properties, ...rest } = c;
    let parsed: Record<string, unknown> = {};
    if (typeof properties === "string" && properties) {
      try {
        const obj = JSON.parse(properties);
        if (obj && typeof obj === "object") parsed = obj as Record<string, unknown>;
      } catch {
        // ignore
      }
    } else if (properties && typeof properties === "object") {
      parsed = properties as Record<string, unknown>;
    }
    return { ...rest, ...parsed };
  };

  const formatContactValue = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "object") {
      try { return JSON.stringify(value); } catch { return ""; }
    }
    return String(value);
  };

  const openContactMap = () => {
    if (htmlContent.trim() === "") {
      toast.error("Generate or paste HTML first");
      return;
    }
    if (segments.length === 0) {
      toast.error("No SwipeOne segments available");
      return;
    }
    // Default to a selected segment if any, otherwise the first segment in the list
    const defaultSeg = selectedSegments[0] || segments[0]?._id || "";
    setContactMapSegmentId(defaultSeg);
    setContactMapContacts([]);
    setContactMapSearch("");
    setContactMapOpen(true);
  };

  const loadContactMapContacts = useCallback(async (segmentId: string) => {
    if (!segmentId) return;
    setContactMapLoading(true);
    try {
      const res = await fetch(
        `/api/swipeone/contacts?segmentId=${encodeURIComponent(segmentId)}&full=1`
      );
      if (res.ok) {
        const data = await res.json();
        setContactMapContacts((data.contacts || []) as Record<string, unknown>[]);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to load contacts");
      }
    } catch {
      toast.error("Failed to load contacts from segment");
    } finally {
      setContactMapLoading(false);
    }
  }, []);

  // Auto-load contacts when the dialog opens or the chosen segment changes.
  useEffect(() => {
    if (contactMapOpen && contactMapSegmentId) {
      loadContactMapContacts(contactMapSegmentId);
    }
  }, [contactMapOpen, contactMapSegmentId, loadContactMapContacts]);

  const applyContactMapping = (contact: Record<string, unknown>) => {
    const flat = flattenContact(contact);
    const replaced = htmlContent.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
      if (key in flat) return formatContactValue(flat[key]);
      return `{{${key}}}`;
    });
    setMappedHtml(replaced);
    const label =
      formatContactValue(flat.fullName) ||
      [flat.firstName, flat.lastName].map(formatContactValue).filter(Boolean).join(" ") ||
      formatContactValue(flat.email) ||
      "Contact";
    setMappedContactLabel(label);
    setContactMapOpen(false);
    toast.success(`Preview rendered with ${label}`);
  };

  const filteredContactMap = contactMapContacts.filter((c) => {
    if (!contactMapSearch.trim()) return true;
    const q = contactMapSearch.toLowerCase();
    const flat = flattenContact(c);
    return (
      formatContactValue(flat.email).toLowerCase().includes(q) ||
      formatContactValue(flat.fullName).toLowerCase().includes(q) ||
      formatContactValue(flat.firstName).toLowerCase().includes(q) ||
      formatContactValue(flat.lastName).toLowerCase().includes(q)
    );
  });

  const toggleSegment = (segmentId: string) => {
    setSelectedSegments((prev) =>
      prev.includes(segmentId) ? prev.filter((id) => id !== segmentId) : [...prev, segmentId]
    );
  };

  const handleImportDynamicTemplate = (t: DynamicTemplateRow) => {
    setSelectedTemplate(t.id);
    setHtmlContent(t.htmlContent || "");
    setJsonContent("");
    setEditorBlocks([]);
    setIsHtmlMode(true);
    if (t.subject && !subject) {
      setSubject(t.subject);
    }
    toast.success(`Imported "${t.name}"`);
  };

  const handleEditorChange = (data: { html: string; json: string }) => {
    setHtmlContent(data.html);
    setJsonContent(data.json);
  };

  const selectedSegmentNames = segments
    .filter((s) => selectedSegments.includes(s._id))
    .map((s) => s.name);

  // Save campaign (always as draft on backend; status changes via the send endpoint)
  async function persistCampaign(): Promise<string | null> {
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        subject,
        fromEmail,
        fromName,
        htmlContent,
        jsonContent,
        recipientEmails: [],
        segmentIds: selectedSegments,
        segmentNames: selectedSegmentNames,
        audienceSource: "swipeone",
        status: "draft",
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to save campaign");
      return null;
    }
    const data = await res.json();
    return data.campaign.id as string;
  }

  const handleSaveDraft = async () => {
    if (!name) {
      toast.error("Campaign name is required");
      return;
    }
    setSaving(true);
    try {
      const id = await persistCampaign();
      if (id) {
        toast.success("Campaign saved as draft");
        router.push(`/campaigns/${id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const validateForSend = (): boolean => {
    if (!name || !subject || !fromEmail) {
      toast.error("Campaign name, subject, and sender email are required");
      return false;
    }
    if (!htmlContent) {
      toast.error("Email content is required");
      return false;
    }
    if (selectedSegments.length === 0) {
      toast.error("Select at least one SwipeOne segment");
      return false;
    }
    return true;
  };

  const handleSchedule = async () => {
    if (!validateForSend()) return;
    if (!scheduledAt) {
      toast.error("Choose a date and time to schedule");
      return;
    }
    const when = new Date(scheduledAt);
    if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      toast.error("Schedule time must be in the future");
      return;
    }
    setScheduling(true);
    try {
      const id = await persistCampaign();
      if (!id) return;
      const res = await fetch(`/api/campaigns/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: when.toISOString() }),
      });
      if (res.ok) {
        toast.success("Campaign scheduled");
        router.push(`/campaigns/${id}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to schedule campaign");
      }
    } finally {
      setScheduling(false);
    }
  };

  const handleSendNow = async () => {
    if (!validateForSend()) return;
    setSending(true);
    try {
      const id = await persistCampaign();
      if (!id) return;
      const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
      if (res.ok) {
        toast.success("Campaign is being sent!");
        router.push(`/campaigns/${id}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to send campaign");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col -mx-6 lg:-mx-8 -mb-6 lg:-mb-8 -mt-16 lg:-mt-8 min-h-screen">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 lg:px-8 py-3 border-b bg-background sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/campaigns"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">SwipeOne Segment Only Campaign</h1>
        </div>
        <div className="flex items-center gap-2">
          {selectedSegments.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Globe className="h-3 w-3 mr-1" />
              {selectedSegments.length} segment{selectedSegments.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Body — single long page */}
      <div className="flex-1 px-6 lg:px-8 py-6 space-y-8">
        {/* Section: Details */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              1. Campaign Details
            </h2>
            <Separator className="mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Campaign Name</Label>
              <Input
                placeholder="e.g. March Newsletter"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email Subject</Label>
              <Input
                placeholder="e.g. Your March Update is Here"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From Email</Label>
              {identitiesLoading ? (
                <div className="flex items-center text-xs text-muted-foreground h-9">
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Loading...
                </div>
              ) : identities.length === 0 ? (
                <p className="text-xs text-muted-foreground h-9 flex items-center">
                  No verified identities. Check AWS SES.
                </p>
              ) : (
                <Select value={fromEmail} onValueChange={(v) => v && setFromEmail(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select verified identity" />
                  </SelectTrigger>
                  <SelectContent>
                    {identities.map((id) => (
                      <SelectItem key={id.identity} value={id.identity}>
                        {id.identity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From Name</Label>
              <Input
                placeholder="e.g. Your Company"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </section>

        {/* Section: SwipeOne Segments */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              2. SwipeOne Segments
            </h2>
            <Separator className="mt-2" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Recipients are fetched from SwipeOne at send time — no contact data is pulled now.
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={loadSegments}
              disabled={segmentsLoading}
            >
              {segmentsLoading ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  Loading...
                </>
              ) : (
                "Refresh"
              )}
            </Button>
          </div>
          {segmentsLoading && segments.length === 0 ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-xs">
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Loading segments...
            </div>
          ) : segments.length === 0 ? (
            <p className="text-muted-foreground text-xs py-3 text-center">
              No segments found. Configure SwipeOne with a Workspace ID in Settings.
            </p>
          ) : (
            <ScrollArea className="h-[220px] border">
              <div className="divide-y">
                {segments.map((segment) => (
                  <div
                    key={segment._id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      id={`seg-${segment._id}`}
                      checked={selectedSegments.includes(segment._id)}
                      onCheckedChange={() => toggleSegment(segment._id)}
                    />
                    <label
                      htmlFor={`seg-${segment._id}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {segment.name}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </section>

        {/* Section: Available Variables */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              3. Available SwipeOne Variables
            </h2>
            <Separator className="mt-2" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {swipeOneFields.length > 0
                ? `${swipeOneFields.length} field(s) — type / inside the editor to insert`
                : "Will load once SwipeOne fields are fetched"}
            </span>
            {swipeOneFieldsLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </div>
          {swipeOneFields.length > 0 && (
            <div className="flex flex-wrap gap-1 max-h-[160px] overflow-auto p-3 border bg-muted/30">
              {swipeOneFields.map((f) => (
                <Badge
                  key={f.name}
                  variant="outline"
                  className="text-[10px] h-5 font-mono"
                  title={f.label}
                >
                  {`{{${f.name}}}`}
                </Badge>
              ))}
            </div>
          )}
        </section>

        {/* Section: Content */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              4. Email Content
            </h2>
            <div className="flex items-center gap-2">
              {isHtmlMode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowHtmlPreview(!showHtmlPreview)}
                >
                  {showHtmlPreview ? (
                    <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {showHtmlPreview ? "Hide Preview" : "Show Preview"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => setIsHtmlMode(!isHtmlMode)}
                disabled={!isHtmlMode && !htmlContent}
                title={!isHtmlMode && !htmlContent ? "Generate or paste HTML to enable" : ""}
              >
                {isHtmlMode ? <Blocks className="h-3.5 w-3.5 mr-1.5" /> : <Code className="h-3.5 w-3.5 mr-1.5" />}
                {isHtmlMode ? "Block Editor" : "HTML Editor"}
              </Button>
            </div>
          </div>
          <Separator />

          {/* AI Generation buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">AI Email Generation:</span>
            <Button
              type="button"
              variant={aiPanel === "regular" ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => {
                const next = aiPanel === "regular" ? "none" : "regular";
                setAiPanel(next);
                if (next === "regular" && regularPrompts.length === 0) fetchSavedPrompts("true");
              }}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Regular Email
            </Button>
            <Button
              type="button"
              variant={aiPanel === "product-update" ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => {
                const next = aiPanel === "product-update" ? "none" : "product-update";
                setAiPanel(next);
                if (next === "product-update" && productPrompts.length === 0) fetchSavedPrompts("product-update");
              }}
            >
              <Package className="h-3.5 w-3.5 mr-1.5" />
              Product Feature Update
            </Button>
            {swipeOneFields.length > 0 && (
              <span className="text-[10px] text-muted-foreground ml-1">
                Generated email will use SwipeOne variables ({swipeOneFields.length} available).
              </span>
            )}
          </div>

          {/* Regular AI panel */}
          {aiPanel === "regular" && (
            <div className="border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  Regular Email — AI Generator
                </div>
                <div className="flex items-center gap-2">
                <Popover
                  open={regularResultsOpen}
                  onOpenChange={(open) => {
                    setRegularResultsOpen(open);
                    if (open) fetchPreviousResults("true");
                  }}
                >
                  <PopoverTrigger
                    render={
                      <Button variant="outline" size="sm" className="h-7 text-xs"
                        title="Load a previously generated or saved template without spending tokens">
                        <RotateCcw className="h-3 w-3 mr-1.5" />
                        Use Previous Results
                      </Button>
                    }
                  />
                  <PopoverContent align="end" className="w-[460px] p-0">
                    <div className="px-3 pt-3 pb-2">
                      <p className="text-sm font-medium">Previous Results — Regular</p>
                      <p className="text-xs text-muted-foreground">
                        AI-generated and saved templates. Click one to load.
                      </p>
                    </div>
                    <Separator />
                    <ScrollArea className="max-h-[360px]">
                      {regularResultsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : regularResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No saved results yet. Generate or save one first.
                        </p>
                      ) : (
                        <div className="p-1">
                          {regularResults.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                applyDynamicTemplate(t);
                                setRegularResultsOpen(false);
                              }}
                              className="w-full text-left rounded-md px-3 py-2 hover:bg-accent transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate flex-1">{t.name}</p>
                                <Badge variant={t.source === "manual" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                  {t.source === "manual" ? "Saved" : "AI"}
                                </Badge>
                              </div>
                              {t.subject && (
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t.subject}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(t.createdAt).toLocaleString()}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <Popover
                  open={regularPromptsOpen}
                  onOpenChange={(open) => {
                    setRegularPromptsOpen(open);
                    if (open && regularPrompts.length === 0) fetchSavedPrompts("true");
                  }}
                >
                  <PopoverTrigger
                    render={
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <History className="h-3 w-3 mr-1.5" />
                        Use Previous Prompts
                      </Button>
                    }
                  />
                  <PopoverContent align="end" className="w-[420px] p-0">
                    <div className="px-3 pt-3 pb-2">
                      <p className="text-sm font-medium">Previous Prompts — Regular</p>
                      <p className="text-xs text-muted-foreground">Click a prompt to fill the form</p>
                    </div>
                    <Separator />
                    <ScrollArea className="max-h-[360px]">
                      {regularPromptsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : regularPrompts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No previous prompts yet for Regular Email.
                        </p>
                      ) : (
                        <div className="p-1">
                          {regularPrompts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => applyPrompt(p)}
                              className="w-full text-left rounded-md px-3 py-2.5 hover:bg-accent transition-colors"
                            >
                              <p className="text-sm line-clamp-2">{p.prompt}</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {p.style}
                                </Badge>
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
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Textarea
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
                    onClick={handleGenerateRegular}
                    disabled={generating || !aiPrompt}
                    size="sm"
                    className="h-9"
                  >
                    {generating ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {generating ? "Generating..." : "Generate"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Product Feature Update AI panel */}
          {aiPanel === "product-update" && (
            <div className="border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4" />
                  Product Feature Update — AI Generator
                </div>
                <div className="flex items-center gap-2">
                <Popover
                  open={productResultsOpen}
                  onOpenChange={(open) => {
                    setProductResultsOpen(open);
                    if (open) fetchPreviousResults("product-update");
                  }}
                >
                  <PopoverTrigger
                    render={
                      <Button variant="outline" size="sm" className="h-7 text-xs"
                        title="Load a previously generated or saved template without spending tokens">
                        <RotateCcw className="h-3 w-3 mr-1.5" />
                        Use Previous Results
                      </Button>
                    }
                  />
                  <PopoverContent align="end" className="w-[460px] p-0">
                    <div className="px-3 pt-3 pb-2">
                      <p className="text-sm font-medium">Previous Results — Product Update</p>
                      <p className="text-xs text-muted-foreground">
                        AI-generated and saved templates. Click one to load.
                      </p>
                    </div>
                    <Separator />
                    <ScrollArea className="max-h-[360px]">
                      {productResultsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : productResults.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No saved results yet. Generate or save one first.
                        </p>
                      ) : (
                        <div className="p-1">
                          {productResults.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                applyDynamicTemplate(t);
                                setProductResultsOpen(false);
                              }}
                              className="w-full text-left rounded-md px-3 py-2 hover:bg-accent transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate flex-1">{t.name}</p>
                                <Badge variant={t.source === "manual" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                                  {t.source === "manual" ? "Saved" : "AI"}
                                </Badge>
                              </div>
                              {t.subject && (
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{t.subject}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(t.createdAt).toLocaleString()}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <Popover
                  open={productPromptsOpen}
                  onOpenChange={(open) => {
                    setProductPromptsOpen(open);
                    if (open && productPrompts.length === 0) fetchSavedPrompts("product-update");
                  }}
                >
                  <PopoverTrigger
                    render={
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <History className="h-3 w-3 mr-1.5" />
                        Use Previous Prompts
                      </Button>
                    }
                  />
                  <PopoverContent align="end" className="w-[420px] p-0">
                    <div className="px-3 pt-3 pb-2">
                      <p className="text-sm font-medium">Previous Prompts — Product Update</p>
                      <p className="text-xs text-muted-foreground">Click a prompt to fill the form</p>
                    </div>
                    <Separator />
                    <ScrollArea className="max-h-[360px]">
                      {productPromptsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : productPrompts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No previous prompts yet for Product Feature Update.
                        </p>
                      ) : (
                        <div className="p-1">
                          {productPrompts.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => applyPrompt(p)}
                              className="w-full text-left rounded-md px-3 py-2.5 hover:bg-accent transition-colors"
                            >
                              <p className="text-sm line-clamp-2">{p.prompt}</p>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(p.createdAt).toLocaleDateString()}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Product Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Acme App"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">New Version Number <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. 2.5.0"
                    value={versionNumber}
                    onChange={(e) => setVersionNumber(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Landing Page URL <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="https://example.com"
                    value={landingPageUrl}
                    onChange={(e) => setLandingPageUrl(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pricing Page URL <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="https://example.com/pricing"
                    value={pricingPageUrl}
                    onChange={(e) => setPricingPageUrl(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    Features <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addFeature}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Feature
                  </Button>
                </div>
                {features.map((feature, index) => (
                  <div key={feature.id} className="border p-3 space-y-2 bg-background">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Feature {index + 1}
                      </span>
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
                    {feature.imageUrl ? (
                      <div className="relative inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={feature.imageUrl}
                          alt={`Feature ${index + 1}`}
                          className="max-h-[140px] border object-contain bg-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFeatures((prev) =>
                              prev.map((f) => (f.id === feature.id ? { ...f, imageUrl: "" } : f))
                            )
                          }
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
                            <span className="text-xs text-muted-foreground">
                              Click to upload screenshot
                            </span>
                          </>
                        )}
                      </label>
                    )}
                    <Input
                      placeholder="Feature caption — e.g. New dashboard with real-time analytics"
                      value={feature.caption}
                      onChange={(e) => updateFeatureCaption(feature.id, e.target.value)}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Additional Instructions (optional)</Label>
                <Textarea
                  placeholder="Tone, colors, branding guidelines..."
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
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {generating ? "Generating..." : "Generate product update email"}
              </Button>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">
                Load from Template{" "}
                <span className="text-muted-foreground/70">
                  ({dynamicLibrary.length} dynamic template{dynamicLibrary.length !== 1 ? "s" : ""})
                </span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[10px]"
                onClick={loadDynamicLibrary}
                disabled={dynamicLibraryLoading}
              >
                {dynamicLibraryLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
            {dynamicLibraryLoading && dynamicLibrary.length === 0 ? (
              <div className="flex items-center justify-center py-4 text-muted-foreground text-xs mt-1.5">
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Loading dynamic templates...
              </div>
            ) : dynamicLibrary.length === 0 ? (
              <p className="text-muted-foreground text-xs py-3 text-center mt-1.5">
                No dynamic templates yet. Generate one with AI or save HTML from the Map Variables modal.
              </p>
            ) : (
              <ScrollArea className="h-[200px] border mt-1.5">
                <div className="divide-y">
                  {dynamicLibrary.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors",
                        selectedTemplate === t.id ? "bg-accent" : ""
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium truncate" title={t.name}>
                            {t.name}
                          </p>
                          <Badge
                            variant={t.source === "manual" ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            {t.source === "manual" ? "Saved" : "AI"}
                          </Badge>
                          {t.aiMode && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                              {t.aiMode === "product-update" ? "Product Update" : "Regular"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {t.subject || "No subject"} · {new Date(t.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setLibraryPreview(t)}
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleImportDynamicTemplate(t)}
                        title="Import into editor"
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Editor — block or HTML */}
          {isHtmlMode ? (
            <div className={cn("grid gap-4", showHtmlPreview ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs">HTML Code</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={formatHtml}
                      disabled={!htmlContent}
                    >
                      <Wand2 className="h-3 w-3 mr-1.5" />
                      Make code readable
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={downloadHtml}
                      disabled={!htmlContent}
                    >
                      <Download className="h-3 w-3 mr-1.5" />
                      Download template
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={openMapVars}
                      disabled={!htmlContent || usedVars.length === 0}
                      title={usedVars.length === 0 ? "No {{variables}} found" : ""}
                    >
                      <UserCog className="h-3 w-3 mr-1.5" />
                      Map Variables
                      {usedVars.length > 0 && (
                        <span className="ml-1 text-muted-foreground">({usedVars.length})</span>
                      )}
                    </Button>
                  </div>
                </div>
                <textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="w-full min-h-[600px] font-mono text-sm p-4 border bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                  spellCheck={false}
                />
              </div>
              {showHtmlPreview && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Preview</Label>
                      {mappedHtml !== null && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {mappedContactLabel ? `Mapped: ${mappedContactLabel}` : "Showing exact preview"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {mappedHtml !== null && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={clearMapping}
                        >
                          <RotateCcw className="h-3 w-3 mr-1.5" />
                          Clear mapping
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={openVarMapper}
                        disabled={!htmlContent}
                      >
                        <UserCog className="h-3 w-3 mr-1.5" />
                        Map a contact variable & Preview Exact
                        {usedVars.length > 0 && (
                          <span className="ml-1 text-muted-foreground">({usedVars.length} variables)</span>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={openContactMap}
                        disabled={!htmlContent}
                      >
                        <UserSearch className="h-3 w-3 mr-1.5" />
                        SwipeOne Contact Map
                        {usedVars.length > 0 && (
                          <span className="ml-1 text-muted-foreground">({usedVars.length} variables)</span>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="border overflow-hidden bg-white" style={{ minHeight: "600px" }}>
                    <iframe
                      ref={previewIframeRef}
                      title="Email Preview"
                      className="w-full border-0"
                      style={{ height: "600px" }}
                      sandbox="allow-same-origin"
                    />
                  </div>

                  {/* Used variables list */}
                  {usedVars.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wider">
                          Variables used
                        </span>
                        <span>
                          ({usedVars.length} distinct, {totalVarOccurrences} occurrence
                          {totalVarOccurrences !== 1 ? "s" : ""})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {usedVars.map(({ name, count }) => {
                          const mappedValue = varValues[name];
                          const hasMapping = mappedHtml !== null && mappedValue !== undefined && mappedValue !== "";
                          return (
                            <Badge
                              key={name}
                              variant={hasMapping ? "secondary" : "outline"}
                              className="text-[10px] h-5 font-mono"
                              title={hasMapping ? `Mapped to: ${mappedValue}` : "Not mapped"}
                            >
                              {`{{${name}}}`}
                              {count > 1 && <span className="ml-1 text-muted-foreground">×{count}</span>}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <EmailEditor
              initialBlocks={editorBlocks}
              onChange={handleEditorChange}
              dynamicFields={swipeOneFields}
            />
          )}

          {/* Variable mapper dialog */}
          <Dialog open={varMapOpen} onOpenChange={setVarMapOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Map a contact variable</DialogTitle>
                <DialogDescription>
                  Provide a sample value for each variable used in the email. The preview will
                  re-render with these values so you can see the exact output before sending.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[420px]">
                <div className="space-y-2 pr-2">
                  {detectedVars.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No {`{{variables}}`} found in the current email.
                    </p>
                  ) : (
                    detectedVars.map((v) => (
                      <div
                        key={v}
                        className="grid grid-cols-[160px_1fr] gap-2 items-center"
                      >
                        <Label className="text-xs font-mono truncate" title={v}>
                          {`{{${v}}}`}
                        </Label>
                        <Input
                          value={varValues[v] ?? ""}
                          onChange={(e) =>
                            setVarValues((prev) => ({ ...prev, [v]: e.target.value }))
                          }
                          placeholder={`Sample value for ${v}`}
                          className="h-8 text-sm"
                        />
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVarMapOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={applyVarMapping}
                  disabled={detectedVars.length === 0}
                >
                  Preview Exact
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Smart Map Variables modal (big — 90vw) */}
          <Dialog open={mapVarsOpen} onOpenChange={setMapVarsOpen}>
            <DialogContent
              className="max-w-[90vw] sm:max-w-[90vw] w-[90vw] max-h-[90vh]"
            >
              <DialogHeader>
                <DialogTitle>Map Variables</DialogTitle>
                <DialogDescription>
                  Edit the HTML on the left. Select any text and click{" "}
                  <span className="font-medium">Map to SwipeOne variable</span> to replace it with a{" "}
                  <code className="font-mono">{`{{name}}`}</code> placeholder. Provide sample values on
                  the right, then click <span className="font-medium">Preview Exact</span>.
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{usedVars.length}</span> distinct variable
                  {usedVars.length !== 1 ? "s" : ""},{" "}
                  <span className="font-semibold text-foreground">{totalVarOccurrences}</span> occurrence
                  {totalVarOccurrences !== 1 ? "s" : ""}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={fillSampleDefaults}
                  disabled={usedVars.length === 0}
                >
                  Fill sample defaults
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-3 h-[68vh] min-h-[420px]">
                {/* Left: editable HTML + inline variable chips */}
                <div className="border bg-muted/20 overflow-hidden flex flex-col">
                  <div className="px-2 py-1.5 border-b bg-muted/40 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Available Variables
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {hasSelection
                          ? `Selected "${codePos.text.length > 40 ? codePos.text.slice(0, 40) + "…" : codePos.text}" — click any variable to replace`
                          : "Click a variable to insert at the cursor"}
                      </span>
                      <div className="ml-auto flex items-center gap-1.5">
                        <Input
                          placeholder="Custom name (e.g. plan_tier)"
                          value={customVarName}
                          onChange={(e) => setCustomVarName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && customVarName.trim()) {
                              e.preventDefault();
                              insertVariable(customVarName);
                            }
                          }}
                          className="h-7 text-xs w-[200px]"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => insertVariable(customVarName)}
                          disabled={!customVarName.trim()}
                        >
                          Use
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-[88px] overflow-auto">
                      {sortedSwipeOneFields.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground italic">
                          SwipeOne fields not loaded — use the custom name input above.
                        </span>
                      ) : (
                        sortedSwipeOneFields.map((f) => {
                          const isPopular = popularVarNames.includes(f.name);
                          return (
                            <button
                              key={f.name}
                              type="button"
                              onClick={() => insertVariable(f.name)}
                              title={
                                isPopular
                                  ? `Popular${f.label !== f.name ? ` — ${f.label}` : ""}`
                                  : f.label !== f.name
                                  ? f.label
                                  : undefined
                              }
                              className={cn(
                                "inline-flex items-center gap-1 font-mono text-[10px] h-6 px-2 rounded border transition-colors cursor-pointer",
                                isPopular
                                  ? hasSelection
                                    ? "border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 ring-1 ring-amber-400 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100"
                                    : "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                                  : hasSelection
                                  ? "border-primary bg-primary/10 text-foreground hover:bg-primary/20 ring-1 ring-primary/40"
                                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                              )}
                            >
                              {isPopular && (
                                <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                              )}
                              {`{{${f.name}}}`}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <textarea
                    ref={codeTextareaRef}
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    onSelect={captureCodePos}
                    onKeyUp={captureCodePos}
                    onMouseUp={captureCodePos}
                    onBlur={captureCodePos}
                    spellCheck={false}
                    className="flex-1 w-full font-mono text-xs p-3 bg-background border-0 outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>

                {/* Right: variable list with inputs */}
                <div className="border overflow-hidden flex flex-col">
                  <div className="px-2 py-1.5 border-b bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Variables
                  </div>
                  <ScrollArea className="flex-1">
                    {usedVars.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-10 px-3">
                        No {`{{variables}}`} found yet. Select text on the left and use{" "}
                        <span className="font-medium">Map to SwipeOne variable</span>.
                      </p>
                    ) : (
                      <div className="divide-y">
                        {usedVars.map(({ name, count }) => (
                          <div key={name} className="p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => scrollToVar(name)}
                                className="text-xs font-mono font-medium hover:underline truncate text-left"
                                title={`Jump to first use of {{${name}}}`}
                              >
                                {`{{${name}}}`}
                              </button>
                              <Badge variant="secondary" className="text-[10px] h-4 shrink-0">
                                {count}×
                              </Badge>
                            </div>
                            <Input
                              value={varValues[name] ?? ""}
                              onChange={(e) =>
                                setVarValues((prev) => ({ ...prev, [name]: e.target.value }))
                              }
                              placeholder={`Sample value for ${name}`}
                              className="h-8 text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMapVarsOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openSaveDynamic}
                  disabled={!htmlContent.trim()}
                  title="Save the current HTML as a Dynamic Template for later reuse"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save As Dynamic Template
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={applyMapVars}
                  disabled={usedVars.length === 0}
                >
                  Preview Exact
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Save As Dynamic Template dialog */}
          <Dialog open={saveDynamicOpen} onOpenChange={setSaveDynamicOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Save As Dynamic Template</DialogTitle>
                <DialogDescription>
                  This template will appear in <span className="font-medium">Use Previous Results</span> and the
                  <span className="font-medium"> Dynamic Templates</span> menu.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Template Name</Label>
                  <Input
                    placeholder="e.g. March Welcome Email"
                    value={saveDynamicName}
                    onChange={(e) => setSaveDynamicName(e.target.value)}
                    className="h-9"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Subject (optional)</Label>
                  <Input
                    placeholder="Default subject line"
                    value={saveDynamicSubject}
                    onChange={(e) => setSaveDynamicSubject(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveDynamicOpen(false)}
                  disabled={savingDynamic}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveDynamicTemplate}
                  disabled={savingDynamic || !saveDynamicName.trim()}
                >
                  {savingDynamic ? "Saving..." : "Save Template"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dynamic template library preview dialog */}
          <Dialog
            open={libraryPreview !== null}
            onOpenChange={(open) => {
              if (!open) setLibraryPreview(null);
            }}
          >
            <DialogContent className="max-w-[90vw] sm:max-w-[90vw] w-[90vw] max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {libraryPreview?.name || "Preview"}
                  {libraryPreview && (
                    <Badge
                      variant={libraryPreview.source === "manual" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {libraryPreview.source === "manual" ? "Saved" : "AI"}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {libraryPreview?.subject || "No subject"}
                  {libraryPreview?.aiMode &&
                    ` — ${libraryPreview.aiMode === "product-update" ? "Product Update" : "Regular"}`}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="h-[68vh] border bg-white">
                <div
                  className="max-w-[600px] mx-auto p-4"
                  dangerouslySetInnerHTML={{ __html: libraryPreview?.htmlContent || "" }}
                />
              </ScrollArea>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLibraryPreview(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (libraryPreview) {
                      handleImportDynamicTemplate(libraryPreview);
                      setLibraryPreview(null);
                    }
                  }}
                  disabled={!libraryPreview}
                >
                  <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* SwipeOne contact mapper dialog */}
          <Dialog open={contactMapOpen} onOpenChange={setContactMapOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>SwipeOne Contact Map</DialogTitle>
                <DialogDescription>
                  Pick a real contact from a SwipeOne segment to render the preview with their data.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Segment</Label>
                  <Select
                    value={contactMapSegmentId}
                    onValueChange={(v) => v && setContactMapSegmentId(v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Choose a segment" />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Search</Label>
                  <Input
                    placeholder="Search by email or name..."
                    value={contactMapSearch}
                    onChange={(e) => setContactMapSearch(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <ScrollArea className="h-[360px] border">
                {contactMapLoading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground text-xs">
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Loading contacts from segment...
                  </div>
                ) : filteredContactMap.length === 0 ? (
                  <p className="text-muted-foreground text-xs py-10 text-center">
                    {contactMapContacts.length === 0
                      ? "No contacts in this segment."
                      : "No contacts match your search."}
                  </p>
                ) : (
                  <div className="divide-y">
                    {filteredContactMap.slice(0, 200).map((c, i) => {
                      const flat = flattenContact(c);
                      const id = formatContactValue(flat._id) || `${i}`;
                      const email = formatContactValue(flat.email);
                      const display =
                        formatContactValue(flat.fullName) ||
                        [flat.firstName, flat.lastName].map(formatContactValue).filter(Boolean).join(" ") ||
                        email ||
                        "Unnamed";
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => applyContactMapping(c)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-accent transition-colors"
                        >
                          <span className="truncate font-medium">{display}</span>
                          {email && email !== display && (
                            <span className="text-[10px] text-muted-foreground truncate">{email}</span>
                          )}
                        </button>
                      );
                    })}
                    {filteredContactMap.length > 200 && (
                      <p className="text-[10px] text-muted-foreground py-2 text-center">
                        Showing first 200 of {filteredContactMap.length} matches — refine your search.
                      </p>
                    )}
                  </div>
                )}
              </ScrollArea>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setContactMapOpen(false)}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </section>

        {/* Section: Schedule */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              5. Schedule (optional)
            </h2>
            <Separator className="mt-2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="h-3 w-3" />
                Send at (local time)
              </Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-9"
              />
            </div>
            {userRole === "super_admin" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={handleSchedule}
                disabled={scheduling || !scheduledAt}
              >
                {scheduling ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  "Schedule"
                )}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground h-9 flex items-center">
                Scheduling requires admin access.
              </p>
            )}
          </div>
        </section>

        {/* Section: Review */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              6. Review
            </h2>
            <Separator className="mt-2" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Campaign Name
              </Label>
              <p className="text-sm font-medium">{name || "Not set"}</p>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Subject
              </Label>
              <p className="text-sm font-medium">{subject || "Not set"}</p>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                From
              </Label>
              <p className="text-sm font-medium">
                {fromEmail ? `${fromName ? fromName + " " : ""}<${fromEmail}>` : "Not set"}
              </p>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Content
              </Label>
              <p className="text-sm font-medium">{htmlContent ? "Ready" : "Not set"}</p>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Segments
              </Label>
              <p className="text-sm font-medium">
                {selectedSegments.length > 0
                  ? selectedSegmentNames.join(", ")
                  : "None selected"}
              </p>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Schedule
              </Label>
              <p className="text-sm font-medium">
                {scheduledAt ? new Date(scheduledAt).toLocaleString() : "Send immediately"}
              </p>
            </div>
          </div>
          {htmlContent && (
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Email Preview
              </Label>
              <div className="border p-4 bg-white max-h-[400px] overflow-auto">
                <div
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                  className="max-w-[600px] mx-auto"
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex items-center justify-end px-6 lg:px-8 py-3 border-t bg-background sticky bottom-0 z-20 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={handleSaveDraft}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Draft"}
        </Button>
        {userRole === "super_admin" && (
          <Button size="sm" className="h-9" onClick={handleSendNow} disabled={sending}>
            {sending ? "Sending..." : "Send Now"}
          </Button>
        )}
      </div>
    </div>
  );
}
