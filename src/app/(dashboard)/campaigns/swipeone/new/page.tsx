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
import { Progress } from "@/components/ui/progress";
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
  ShieldAlert,
  Megaphone,
  BadgePercent,
  Tag,
  Crown,
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
  Columns3,
  Columns4,
  Grid3x3,
  Send,
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

type AiPanel =
  | "none"
  | "regular"
  | "product-update"
  | "product-security"
  | "product-marketing"
  | "summer-sale"
  | "bfcm-sale"
  | "ceo-offer";

const AI_MODE_LABELS: Record<string, string> = {
  "true": "Regular",
  "product-update": "Product Update",
  "product-security": "Product Security",
  "product-marketing": "Product Marketing",
  "summer-sale": "Summer Sale",
  "bfcm-sale": "BFCM Sale",
  "ceo-offer": "CEOs Offer",
};

const aiModeLabel = (mode: string | null | undefined) =>
  mode ? AI_MODE_LABELS[mode] ?? mode : "";

interface IssueItem {
  id: string;
  issue: string;
  solution: string;
}

interface ProductOption {
  id: string;
  name: string;
  logoUrl: string | null;
  wpOrgSlug: string | null;
  landingPageUrl: string | null;
  pricingPageUrl: string | null;
}

interface CampaignCategoryOption {
  id: string;
  name: string;
  description?: string | null;
}

interface SesIdentity {
  identity: string;
  type: string;
  verified: boolean;
}

interface Segment {
  _id: string;
  name: string;
}

export function SwipeOneCampaignEditor({
  campaignId: initialCampaignId = null,
}: { campaignId?: string | null } = {}) {
  const router = useRouter();
  const existingCampaignId: string | null = initialCampaignId;
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);

  // Send Preview dialog
  const [previewSendOpen, setPreviewSendOpen] = useState(false);
  const [previewSendEmail, setPreviewSendEmail] = useState("");
  const [previewSendVarValues, setPreviewSendVarValues] = useState<Record<string, string>>({});
  const [sendingPreview, setSendingPreview] = useState(false);

  // Details
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<CampaignCategoryOption[]>([]);
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
  const [libraryCols, setLibraryCols] = useState<3 | 4 | 5 | 6>(5);

  useEffect(() => {
    const saved = localStorage.getItem("swipeone-library-grid-cols");
    const n = Number(saved);
    if (n === 3 || n === 4 || n === 5 || n === 6) setLibraryCols(n as 3 | 4 | 5 | 6);
  }, []);

  const updateLibraryCols = (n: 3 | 4 | 5 | 6) => {
    setLibraryCols(n);
    localStorage.setItem("swipeone-library-grid-cols", String(n));
  };

  const libraryGridClass =
    libraryCols === 3
      ? "grid-cols-2 md:grid-cols-3"
      : libraryCols === 4
        ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        : libraryCols === 5
          ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";
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
  const [productLogoUrl, setProductLogoUrl] = useState("");
  const [landingPageUrl, setLandingPageUrl] = useState("");
  const [pricingPageUrl, setPricingPageUrl] = useState("");
  const [versionNumber, setVersionNumber] = useState("");
  const [productInstruction, setProductInstruction] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
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

  const [securityPrompts, setSecurityPrompts] = useState<SavedPrompt[]>([]);
  const [securityPromptsLoading, setSecurityPromptsLoading] = useState(false);
  const [securityPromptsOpen, setSecurityPromptsOpen] = useState(false);

  const [securityIssues, setSecurityIssues] = useState<IssueItem[]>([
    { id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()), issue: "", solution: "" },
  ]);
  const [securityInstruction, setSecurityInstruction] = useState("");
  const [selectedSecurityProductId, setSelectedSecurityProductId] = useState<string>("");

  // Product marketing fields
  const [marketingPrompts, setMarketingPrompts] = useState<SavedPrompt[]>([]);
  const [marketingPromptsLoading, setMarketingPromptsLoading] = useState(false);
  const [marketingPromptsOpen, setMarketingPromptsOpen] = useState(false);
  const [marketingFeatures, setMarketingFeatures] = useState<FeatureItem[]>([
    { id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Date.now()), imageUrl: "", caption: "", uploading: false },
  ]);
  const [marketingHeadline, setMarketingHeadline] = useState("");
  const [marketingInstruction, setMarketingInstruction] = useState("");
  const [selectedMarketingProductId, setSelectedMarketingProductId] = useState<string>("");

  // Summer sale fields
  const [salePrompts, setSalePrompts] = useState<SavedPrompt[]>([]);
  const [salePromptsLoading, setSalePromptsLoading] = useState(false);
  const [salePromptsOpen, setSalePromptsOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [saleEndDate, setSaleEndDate] = useState("");
  const [saleHeadline, setSaleHeadline] = useState("");
  const [saleInstruction, setSaleInstruction] = useState("");
  const [selectedSaleProductId, setSelectedSaleProductId] = useState<string>("");

  // BFCM sale fields
  const [bfcmPrompts, setBfcmPrompts] = useState<SavedPrompt[]>([]);
  const [bfcmPromptsLoading, setBfcmPromptsLoading] = useState(false);
  const [bfcmPromptsOpen, setBfcmPromptsOpen] = useState(false);
  const [bfcmPromoCode, setBfcmPromoCode] = useState("");
  const [bfcmDiscountValue, setBfcmDiscountValue] = useState("");
  const [bfcmEndDate, setBfcmEndDate] = useState("");
  const [bfcmHeadline, setBfcmHeadline] = useState("");
  const [bfcmInstruction, setBfcmInstruction] = useState("");
  const [selectedBfcmProductId, setSelectedBfcmProductId] = useState<string>("");

  // CEOs Offer fields
  const [ceoPrompts, setCeoPrompts] = useState<SavedPrompt[]>([]);
  const [ceoPromptsLoading, setCeoPromptsLoading] = useState(false);
  const [ceoPromptsOpen, setCeoPromptsOpen] = useState(false);
  const [ceoPromoCode, setCeoPromoCode] = useState("");
  const [ceoName, setCeoName] = useState("");
  const [ceoPhotoUrl, setCeoPhotoUrl] = useState("");
  const [ceoDiscountValue, setCeoDiscountValue] = useState("");
  const [ceoHeadline, setCeoHeadline] = useState("");
  const [ceoInstruction, setCeoInstruction] = useState("");
  const [selectedCeoProductId, setSelectedCeoProductId] = useState<string>("");

  // Saved AI results / Dynamic Templates (per panel)
  const [regularResults, setRegularResults] = useState<DynamicTemplateRow[]>([]);
  const [regularResultsLoading, setRegularResultsLoading] = useState(false);
  const [regularResultsOpen, setRegularResultsOpen] = useState(false);

  const [productResults, setProductResults] = useState<DynamicTemplateRow[]>([]);
  const [productResultsLoading, setProductResultsLoading] = useState(false);
  const [productResultsOpen, setProductResultsOpen] = useState(false);

  const [securityResults, setSecurityResults] = useState<DynamicTemplateRow[]>([]);
  const [securityResultsLoading, setSecurityResultsLoading] = useState(false);
  const [securityResultsOpen, setSecurityResultsOpen] = useState(false);

  const [marketingResults, setMarketingResults] = useState<DynamicTemplateRow[]>([]);
  const [marketingResultsLoading, setMarketingResultsLoading] = useState(false);
  const [marketingResultsOpen, setMarketingResultsOpen] = useState(false);

  const [saleResults, setSaleResults] = useState<DynamicTemplateRow[]>([]);
  const [saleResultsLoading, setSaleResultsLoading] = useState(false);
  const [saleResultsOpen, setSaleResultsOpen] = useState(false);

  const [bfcmResults, setBfcmResults] = useState<DynamicTemplateRow[]>([]);
  const [bfcmResultsLoading, setBfcmResultsLoading] = useState(false);
  const [bfcmResultsOpen, setBfcmResultsOpen] = useState(false);

  const [ceoResults, setCeoResults] = useState<DynamicTemplateRow[]>([]);
  const [ceoResultsLoading, setCeoResultsLoading] = useState(false);
  const [ceoResultsOpen, setCeoResultsOpen] = useState(false);

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

  const loadProductOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProductOptions((data.products || []) as ProductOption[]);
      }
    } catch {
      // optional
    }
  }, []);

  const loadCategoryOptions = useCallback(async () => {
    try {
      const res = await fetch("/api/campaign-categories");
      if (res.ok) {
        const data = await res.json();
        setCategoryOptions((data.categories || []) as CampaignCategoryOption[]);
      }
    } catch {
      // optional
    }
  }, []);

  const loadPredefinedInstruction = useCallback(async () => {
    try {
      const res = await fetch("/api/app-settings?key=predefinedInstruction");
      if (res.ok) {
        const data = await res.json();
        const v = typeof data?.value === "string" ? data.value : "";
        if (!v) return;
        setProductInstruction((prev) => (prev ? prev : v));
        setSecurityInstruction((prev) => (prev ? prev : v));
        setMarketingInstruction((prev) => (prev ? prev : v));
        setSaleInstruction((prev) => (prev ? prev : v));
        setBfcmInstruction((prev) => (prev ? prev : v));
        setCeoInstruction((prev) => (prev ? prev : v));
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
    loadProductOptions();
    loadCategoryOptions();
    loadPredefinedInstruction();
  }, [
    loadSegments,
    loadSwipeOneFields,
    loadPopularVariables,
    loadDynamicLibrary,
    loadProductOptions,
    loadCategoryOptions,
    loadPredefinedInstruction,
  ]);

  // Refresh popular variables whenever the Map Variables modal opens, so
  // changes from Settings appear without a full page reload.
  useEffect(() => {
    if (mapVarsOpen) loadPopularVariables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapVarsOpen]);

  // Edit mode: when the editor is mounted with an existing campaignId
  // (from /campaigns/swipeone/[id] or after a duplicate redirect), fetch the
  // campaign once and pre-populate every editable field.
  useEffect(() => {
    if (!existingCampaignId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/campaigns/${existingCampaignId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error || "Failed to load campaign");
          return;
        }
        const data = await res.json();
        const c = data.campaign;
        if (!c || cancelled) return;

        if (typeof c.name === "string") setName(c.name);
        if (typeof c.subject === "string") setSubject(c.subject);
        if (typeof c.fromEmail === "string") setFromEmail(c.fromEmail);
        if (typeof c.fromName === "string") setFromName(c.fromName);
        if (typeof c.categoryId === "string" || c.categoryId === null) {
          setCategoryId(c.categoryId || "");
        }

        if (typeof c.htmlContent === "string" && c.htmlContent.trim()) {
          setHtmlContent(c.htmlContent);
          setIsHtmlMode(true);
        }
        if (typeof c.jsonContent === "string" && c.jsonContent.trim()) {
          setJsonContent(c.jsonContent);
        }

        // SwipeOne segment ids/names are stored as JSON strings.
        if (typeof c.segmentIds === "string" && c.segmentIds.trim()) {
          try {
            const ids = JSON.parse(c.segmentIds);
            if (Array.isArray(ids)) {
              setSelectedSegments(ids.filter((x): x is string => typeof x === "string"));
            }
          } catch { /* ignore */ }
        }
      } catch {
        toast.error("Failed to load campaign");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingCampaignId]);

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

  const fetchSavedPrompts = useCallback(
    async (
      mode:
        | "true"
        | "product-update"
        | "product-security"
        | "product-marketing"
        | "summer-sale"
        | "bfcm-sale"
        | "ceo-offer"
    ) => {
      if (mode === "true") setRegularPromptsLoading(true);
      else if (mode === "product-update") setProductPromptsLoading(true);
      else if (mode === "product-security") setSecurityPromptsLoading(true);
      else if (mode === "product-marketing") setMarketingPromptsLoading(true);
      else if (mode === "summer-sale") setSalePromptsLoading(true);
      else if (mode === "bfcm-sale") setBfcmPromptsLoading(true);
      else setCeoPromptsLoading(true);
      try {
        const res = await fetch(`/api/ai-prompts?aiMode=${encodeURIComponent(mode)}`);
        if (res.ok) {
          const data = await res.json();
          if (mode === "true") setRegularPrompts(data.prompts || []);
          else if (mode === "product-update") setProductPrompts(data.prompts || []);
          else if (mode === "product-security") setSecurityPrompts(data.prompts || []);
          else if (mode === "product-marketing") setMarketingPrompts(data.prompts || []);
          else if (mode === "summer-sale") setSalePrompts(data.prompts || []);
          else if (mode === "bfcm-sale") setBfcmPrompts(data.prompts || []);
          else setCeoPrompts(data.prompts || []);
        }
      } catch {
        // ignore
      } finally {
        if (mode === "true") setRegularPromptsLoading(false);
        else if (mode === "product-update") setProductPromptsLoading(false);
        else if (mode === "product-security") setSecurityPromptsLoading(false);
        else if (mode === "product-marketing") setMarketingPromptsLoading(false);
        else if (mode === "summer-sale") setSalePromptsLoading(false);
        else if (mode === "bfcm-sale") setBfcmPromptsLoading(false);
        else setCeoPromptsLoading(false);
      }
    },
    []
  );

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
      const logoMatch = p.prompt.match(/Product logo:\s*(\S+)/);
      if (logoMatch) setProductLogoUrl(logoMatch[1]);
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
    } else if (p.aiMode === "product-security") {
      const productMatch = p.prompt.match(/for "([^"]+)" version ([^\s.]+(?:\.\S*)?)/);
      if (productMatch) {
        setProductName(productMatch[1]);
        setVersionNumber(productMatch[2]);
      }
      const landingMatch = p.prompt.match(/Product landing page:\s*(\S+)/);
      if (landingMatch) setLandingPageUrl(landingMatch[1]);
      const pricingMatch = p.prompt.match(/Pricing page:\s*(\S+)/);
      if (pricingMatch) setPricingPageUrl(pricingMatch[1]);
      const logoMatch = p.prompt.match(/Product logo:\s*(\S+)/);
      if (logoMatch) setProductLogoUrl(logoMatch[1]);
      const issueMatches = [
        ...p.prompt.matchAll(/Issue \d+:\s*"([^"]+)"\s*\|\s*Solution:\s*"([^"]+)"/g),
      ];
      if (issueMatches.length > 0) {
        setSecurityIssues(
          issueMatches.map((m) => ({
            id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
            issue: m[1],
            solution: m[2],
          }))
        );
      }
      const instructionMatch = p.prompt.match(/Additional instructions:\s*([\s\S]+?)(?:\n\nRequirements:|$)/);
      if (instructionMatch) setSecurityInstruction(instructionMatch[1].trim());
      setAiPanel("product-security");
      setSecurityPromptsOpen(false);
    } else if (p.aiMode === "product-marketing") {
      const productMatch = p.prompt.match(/marketing email for "([^"]+)"/);
      if (productMatch) setProductName(productMatch[1]);
      const headlineMatch = p.prompt.match(/Headline\/hook:\s*"([^"]+)"/);
      if (headlineMatch) setMarketingHeadline(headlineMatch[1]);
      const landingMatch = p.prompt.match(/Product landing page:\s*(\S+)/);
      if (landingMatch) setLandingPageUrl(landingMatch[1]);
      const pricingMatch = p.prompt.match(/Pricing page:\s*(\S+)/);
      if (pricingMatch) setPricingPageUrl(pricingMatch[1]);
      const logoMatch = p.prompt.match(/Product logo:\s*(\S+)/);
      if (logoMatch) setProductLogoUrl(logoMatch[1]);
      const featureMatches = [...p.prompt.matchAll(/Highlight \d+:\s*"([^"]+)"\s*\(screenshot:\s*(\S+)\)/g)];
      if (featureMatches.length > 0) {
        setMarketingFeatures(
          featureMatches.map((m) => ({
            id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
            caption: m[1],
            imageUrl: m[2],
            uploading: false,
          }))
        );
      }
      const instructionMatch = p.prompt.match(/Additional instructions:\s*([\s\S]+?)(?:\n\nRequirements:|$)/);
      if (instructionMatch) setMarketingInstruction(instructionMatch[1].trim());
      setAiPanel("product-marketing");
      setMarketingPromptsOpen(false);
    } else if (p.aiMode === "summer-sale") {
      const productMatch = p.prompt.match(/summer sale email for "([^"]+)"/);
      if (productMatch) setProductName(productMatch[1]);
      const promoMatch = p.prompt.match(/Promo code:\s*"([^"]+)"/);
      if (promoMatch) setPromoCode(promoMatch[1]);
      const discountMatch = p.prompt.match(/Discount:\s*"([^"]+)"/);
      if (discountMatch) setDiscountValue(discountMatch[1]);
      const endDateMatch = p.prompt.match(/Sale ends:\s*"([^"]+)"/);
      if (endDateMatch) setSaleEndDate(endDateMatch[1]);
      const headlineMatch = p.prompt.match(/Headline\/hook:\s*"([^"]+)"/);
      if (headlineMatch) setSaleHeadline(headlineMatch[1]);
      const landingMatch = p.prompt.match(/Product landing page:\s*(\S+)/);
      if (landingMatch) setLandingPageUrl(landingMatch[1]);
      const pricingMatch = p.prompt.match(/Pricing page:\s*(\S+)/);
      if (pricingMatch) setPricingPageUrl(pricingMatch[1]);
      const logoMatch = p.prompt.match(/Product logo:\s*(\S+)/);
      if (logoMatch) setProductLogoUrl(logoMatch[1]);
      const instructionMatch = p.prompt.match(/Additional instructions:\s*([\s\S]+?)(?:\n\nRequirements:|$)/);
      if (instructionMatch) setSaleInstruction(instructionMatch[1].trim());
      setAiPanel("summer-sale");
      setSalePromptsOpen(false);
    } else if (p.aiMode === "bfcm-sale") {
      const productMatch = p.prompt.match(/BFCM sale email for "([^"]+)"/);
      if (productMatch) setProductName(productMatch[1]);
      const promoMatch = p.prompt.match(/Promo code:\s*"([^"]+)"/);
      if (promoMatch) setBfcmPromoCode(promoMatch[1]);
      const discountMatch = p.prompt.match(/Discount:\s*"([^"]+)"/);
      if (discountMatch) setBfcmDiscountValue(discountMatch[1]);
      const endDateMatch = p.prompt.match(/Sale ends:\s*"([^"]+)"/);
      if (endDateMatch) setBfcmEndDate(endDateMatch[1]);
      const headlineMatch = p.prompt.match(/Headline\/hook:\s*"([^"]+)"/);
      if (headlineMatch) setBfcmHeadline(headlineMatch[1]);
      const landingMatch = p.prompt.match(/Product landing page:\s*(\S+)/);
      if (landingMatch) setLandingPageUrl(landingMatch[1]);
      const pricingMatch = p.prompt.match(/Pricing page:\s*(\S+)/);
      if (pricingMatch) setPricingPageUrl(pricingMatch[1]);
      const logoMatch = p.prompt.match(/Product logo:\s*(\S+)/);
      if (logoMatch) setProductLogoUrl(logoMatch[1]);
      const instructionMatch = p.prompt.match(/Additional instructions:\s*([\s\S]+?)(?:\n\nRequirements:|$)/);
      if (instructionMatch) setBfcmInstruction(instructionMatch[1].trim());
      setAiPanel("bfcm-sale");
      setBfcmPromptsOpen(false);
    } else if (p.aiMode === "ceo-offer") {
      const productMatch = p.prompt.match(/CEOs Offer email for "([^"]+)"/);
      if (productMatch) setProductName(productMatch[1]);
      const ceoNameMatch = p.prompt.match(/CEO name:\s*"([^"]+)"/);
      if (ceoNameMatch) setCeoName(ceoNameMatch[1]);
      const ceoPhotoMatch = p.prompt.match(/CEO photo:\s*(\S+)/);
      if (ceoPhotoMatch) setCeoPhotoUrl(ceoPhotoMatch[1]);
      const promoMatch = p.prompt.match(/Promo code:\s*"([^"]+)"/);
      if (promoMatch) setCeoPromoCode(promoMatch[1]);
      const discountMatch = p.prompt.match(/Discount:\s*"([^"]+)"/);
      if (discountMatch) setCeoDiscountValue(discountMatch[1]);
      const headlineMatch = p.prompt.match(/Headline\/hook:\s*"([^"]+)"/);
      if (headlineMatch) setCeoHeadline(headlineMatch[1]);
      const landingMatch = p.prompt.match(/Product landing page:\s*(\S+)/);
      if (landingMatch) setLandingPageUrl(landingMatch[1]);
      const pricingMatch = p.prompt.match(/Pricing page:\s*(\S+)/);
      if (pricingMatch) setPricingPageUrl(pricingMatch[1]);
      const logoMatch = p.prompt.match(/Product logo:\s*(\S+)/);
      if (logoMatch) setProductLogoUrl(logoMatch[1]);
      const instructionMatch = p.prompt.match(/Additional instructions:\s*([\s\S]+?)(?:\n\nRequirements:|$)/);
      if (instructionMatch) setCeoInstruction(instructionMatch[1].trim());
      setAiPanel("ceo-offer");
      setCeoPromptsOpen(false);
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

  const addSecurityIssue = () => {
    setSecurityIssues((prev) => [
      ...prev,
      { id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()), issue: "", solution: "" },
    ]);
  };

  const removeSecurityIssue = (id: string) => {
    setSecurityIssues((prev) => prev.filter((f) => f.id !== id));
  };

  const updateSecurityIssue = (id: string, field: "issue" | "solution", value: string) => {
    setSecurityIssues((prev) => prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)));
  };

  const addMarketingFeature = () => {
    setMarketingFeatures((prev) => [
      ...prev,
      { id: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()), imageUrl: "", caption: "", uploading: false },
    ]);
  };

  const removeMarketingFeature = (id: string) => {
    setMarketingFeatures((prev) => prev.filter((f) => f.id !== id));
  };

  const updateMarketingFeatureCaption = (id: string, caption: string) => {
    setMarketingFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, caption } : f)));
  };

  const handleMarketingFeatureImageUpload = async (id: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
      return;
    }
    setMarketingFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, uploading: true } : f)));
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setMarketingFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, imageUrl: data.url, uploading: false } : f)));
      } else {
        const data = await res.json();
        toast.error(data.error || "Upload failed");
        setMarketingFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, uploading: false } : f)));
      }
    } catch {
      toast.error("Upload failed");
      setMarketingFeatures((prev) => prev.map((f) => (f.id === id ? { ...f, uploading: false } : f)));
    }
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
  const inferAiMode = ():
    | "product-update"
    | "product-security"
    | "product-marketing"
    | "summer-sale"
    | "bfcm-sale"
    | "ceo-offer"
    | "true" =>
    aiPanel === "product-update"
      ? "product-update"
      : aiPanel === "product-security"
        ? "product-security"
        : aiPanel === "product-marketing"
          ? "product-marketing"
          : aiPanel === "summer-sale"
            ? "summer-sale"
            : aiPanel === "bfcm-sale"
              ? "bfcm-sale"
              : aiPanel === "ceo-offer"
                ? "ceo-offer"
                : "true";

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
    async (
      mode:
        | "true"
        | "product-update"
        | "product-security"
        | "product-marketing"
        | "summer-sale"
        | "bfcm-sale"
        | "ceo-offer"
    ) => {
      if (mode === "true") setRegularResultsLoading(true);
      else if (mode === "product-update") setProductResultsLoading(true);
      else if (mode === "product-security") setSecurityResultsLoading(true);
      else if (mode === "product-marketing") setMarketingResultsLoading(true);
      else if (mode === "summer-sale") setSaleResultsLoading(true);
      else if (mode === "bfcm-sale") setBfcmResultsLoading(true);
      else setCeoResultsLoading(true);
      try {
        const res = await fetch(`/api/dynamic-templates?aiMode=${encodeURIComponent(mode)}`);
        if (res.ok) {
          const data = await res.json();
          const list = (data.templates || []) as DynamicTemplateRow[];
          if (mode === "true") setRegularResults(list);
          else if (mode === "product-update") setProductResults(list);
          else if (mode === "product-security") setSecurityResults(list);
          else if (mode === "product-marketing") setMarketingResults(list);
          else if (mode === "summer-sale") setSaleResults(list);
          else if (mode === "bfcm-sale") setBfcmResults(list);
          else setCeoResults(list);
        }
      } catch {
        // ignore
      } finally {
        if (mode === "true") setRegularResultsLoading(false);
        else if (mode === "product-update") setProductResultsLoading(false);
        else if (mode === "product-security") setSecurityResultsLoading(false);
        else if (mode === "product-marketing") setMarketingResultsLoading(false);
        else if (mode === "summer-sale") setSaleResultsLoading(false);
        else if (mode === "bfcm-sale") setBfcmResultsLoading(false);
        else setCeoResultsLoading(false);
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
Pricing page: ${pricingPageUrl}${productLogoUrl ? `\nProduct logo: ${productLogoUrl}` : ""}

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
- Include a secondary link to the pricing page ${pricingPageUrl}${productLogoUrl ? `\n- Display the product logo at the top of the email using the provided URL: <img src="${productLogoUrl}" alt="${productName}" style="max-width:128px;height:auto;display:block;" />` : ""}
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

  const handleGenerateProductSecurity = async () => {
    if (!productName) { toast.error("Product name is required"); return; }
    if (!landingPageUrl) { toast.error("Landing page URL is required"); return; }
    if (!pricingPageUrl) { toast.error("Pricing page URL is required"); return; }
    if (!versionNumber) { toast.error("Version number is required"); return; }

    const validIssues = securityIssues.filter((f) => f.issue.trim() && f.solution.trim());
    if (validIssues.length === 0) {
      toast.error("Add at least one issue with a solution");
      return;
    }

    setGenerating(true);
    try {
      const issuesDescription = validIssues
        .map((f, i) => `Issue ${i + 1}: "${f.issue.trim()}" | Solution: "${f.solution.trim()}"`)
        .join("\n");

      const prompt = `Generate a product security update email for "${productName}" version ${versionNumber}.

Product landing page: ${landingPageUrl}
Pricing page: ${pricingPageUrl}${productLogoUrl ? `\nProduct logo: ${productLogoUrl}` : ""}

Security issues addressed in this release (each MUST be presented with both the issue and the solution):
${issuesDescription}

${securityInstruction ? `Additional instructions: ${securityInstruction}` : ""}

Requirements:
- The email tone should be reassuring, transparent, and security-focused
- Open with a clear statement that a security update has been released for ${productName} ${versionNumber}
- For each issue, render a section with:
  1. A clear "Issue" heading describing the problem
  2. A "Solution" / "Fix" subsection describing how it was resolved in this version
- Strongly encourage users to update to ${versionNumber} immediately
- Include a CTA button linking to ${landingPageUrl} (e.g. "Update ${productName} now")
- Include a secondary link to the pricing page ${pricingPageUrl}${productLogoUrl ? `\n- Display the product logo at the top of the email using the provided URL: <img src="${productLogoUrl}" alt="${productName}" style="max-width:128px;height:auto;display:block;" />` : ""}
- Use inline styles for email compatibility
- Make it responsive and modern looking${buildVariableHint()}`;

      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: "professional",
          templateName: `${productName} v${versionNumber} Security Update`,
          templateSubject: `${productName} v${versionNumber} — Security Update`,
          aiMode: "product-security",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        applyGenerated(data.html || "", data.subject, `${productName} v${versionNumber} Security Update`);
        toast.success("Product security update email generated!");
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

  const handleGenerateProductMarketing = async () => {
    if (!productName) { toast.error("Product name is required"); return; }
    if (!landingPageUrl) { toast.error("Landing page URL is required"); return; }
    if (!pricingPageUrl) { toast.error("Pricing page URL is required"); return; }

    const validFeatures = marketingFeatures.filter((f) => f.imageUrl && f.caption);
    if (validFeatures.length === 0) {
      toast.error("Add at least one highlight with screenshot and caption");
      return;
    }

    setGenerating(true);
    try {
      const featuresDescription = validFeatures
        .map((f, i) => `Highlight ${i + 1}: "${f.caption}" (screenshot: ${f.imageUrl})`)
        .join("\n");

      const prompt = `Generate a product marketing email for "${productName}" focused on driving interest, clicks, and conversions.

${marketingHeadline ? `Headline/hook: "${marketingHeadline}"\n` : ""}Product landing page: ${landingPageUrl}
Pricing page: ${pricingPageUrl}${productLogoUrl ? `\nProduct logo: ${productLogoUrl}` : ""}

Highlights to showcase (each has a screenshot that MUST be embedded as an <img> tag):
${featuresDescription}

${marketingInstruction ? `Additional instructions: ${marketingInstruction}` : ""}

Requirements:
- This is a MARKETING email — the look and feel must differ from a release-notes / changelog email
- Lead with a bold, benefit-driven hero section: large headline${marketingHeadline ? ` (use "${marketingHeadline}" or a refined version)` : ""}, a 1–2 sentence subheading selling the value to the reader, and a primary CTA button
- Use a vibrant, conversion-focused visual style (gradient or accent-colored hero background, generous padding, large headings, prominent CTA buttons)
- For each highlight, render an alternating two-column layout where possible:
  1. The screenshot image (<img src="..." width="100%" style="max-width:560px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.08);" />)
  2. A punchy benefit-led title (NOT a feature name — sell the outcome)
  3. A 2–3 sentence persuasive description that focuses on customer value, not technical detail
- Include social proof framing where reasonable (e.g. "Join thousands using ${productName}")
- Primary CTA button must link to ${landingPageUrl} with action-oriented copy (e.g. "Get ${productName}", "Try it free", "See it in action")
- Add a secondary, lower-emphasis link to the pricing page ${pricingPageUrl} (e.g. "View pricing")
- Close with a final CTA section reinforcing the offer${productLogoUrl ? `\n- Display the product logo at the top of the email using the provided URL: <img src="${productLogoUrl}" alt="${productName}" style="max-width:128px;height:auto;display:block;" />` : ""}
- Use inline styles for email compatibility
- Make it responsive and visually polished — this should feel like a marketing campaign, not a transactional notification${buildVariableHint()}`;

      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: "marketing",
          templateName: `${productName} Marketing Email`,
          templateSubject: marketingHeadline || `Discover what's new with ${productName}`,
          aiMode: "product-marketing",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        applyGenerated(data.html || "", data.subject, `${productName} Marketing Email`);
        toast.success("Product marketing email generated!");
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

  const handleGenerateSummerSale = async () => {
    if (!productName) { toast.error("Product name is required"); return; }
    if (!promoCode) { toast.error("Promo code is required"); return; }
    if (!discountValue) { toast.error("Discount is required"); return; }
    if (!landingPageUrl) { toast.error("Landing page URL is required"); return; }
    if (!pricingPageUrl) { toast.error("Pricing page URL is required"); return; }

    setGenerating(true);
    try {
      const prompt = `Generate a summer sale email for "${productName}".

Promo code: "${promoCode}"
Discount: "${discountValue}"${saleEndDate ? `\nSale ends: "${saleEndDate}"` : ""}
${saleHeadline ? `Headline/hook: "${saleHeadline}"\n` : ""}Product landing page: ${landingPageUrl}
Pricing page: ${pricingPageUrl}${productLogoUrl ? `\nProduct logo: ${productLogoUrl}` : ""}

${saleInstruction ? `Additional instructions: ${saleInstruction}` : ""}

Requirements:
- This is a SUMMER SALE promotional email — design it to feel celebratory, vibrant, and urgent
- Use warm, summery visual cues (sunny gradients, oranges/yellows/pinks/teals, beach/sun/wave accents) while staying tasteful and on-brand
- Lead with a bold hero section: large headline${saleHeadline ? ` (use "${saleHeadline}" or a refined version)` : " announcing the summer sale"}, a 1–2 sentence subheading selling the value, and a primary CTA button
- Display the promo code "${promoCode}" prominently — render it inside a high-contrast, dashed-border code box that's easy to copy, with helper text such as "Use code at checkout"
- Make the discount "${discountValue}" the most visually dominant element after the headline
${saleEndDate ? `- Reinforce urgency by clearly stating the sale ends ${saleEndDate}; consider phrases like "Ends ${saleEndDate}" near the CTA` : "- Add gentle urgency wording (e.g. \"Limited time\") even without a fixed end date"}
- Primary CTA button must link to ${landingPageUrl} with action-oriented copy (e.g. "Claim your discount", "Shop the sale")
- Add a secondary, lower-emphasis link to the pricing page ${pricingPageUrl} (e.g. "View pricing")
- Close with a final reminder of the promo code and end date${productLogoUrl ? `\n- Display the product logo at the top of the email using the provided URL: <img src="${productLogoUrl}" alt="${productName}" style="max-width:128px;height:auto;display:block;" />` : ""}
- Use inline styles for email compatibility
- Make it responsive and visually polished — this should feel like a seasonal marketing campaign, not a transactional notification${buildVariableHint()}`;

      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: "marketing",
          templateName: `${productName} Summer Sale — ${promoCode}`,
          templateSubject: saleHeadline || `Summer sale: ${discountValue} off ${productName} with ${promoCode}`,
          aiMode: "summer-sale",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        applyGenerated(data.html || "", data.subject, `${productName} Summer Sale — ${promoCode}`);
        toast.success("Summer sale email generated!");
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

  const handleGenerateBfcmSale = async () => {
    if (!productName) { toast.error("Product name is required"); return; }
    if (!bfcmPromoCode) { toast.error("Promo code is required"); return; }
    if (!bfcmDiscountValue) { toast.error("Discount is required"); return; }
    if (!landingPageUrl) { toast.error("Landing page URL is required"); return; }
    if (!pricingPageUrl) { toast.error("Pricing page URL is required"); return; }

    setGenerating(true);
    try {
      const prompt = `Generate a BFCM sale email for "${productName}".

Promo code: "${bfcmPromoCode}"
Discount: "${bfcmDiscountValue}"${bfcmEndDate ? `\nSale ends: "${bfcmEndDate}"` : ""}
${bfcmHeadline ? `Headline/hook: "${bfcmHeadline}"\n` : ""}Product landing page: ${landingPageUrl}
Pricing page: ${pricingPageUrl}${productLogoUrl ? `\nProduct logo: ${productLogoUrl}` : ""}

${bfcmInstruction ? `Additional instructions: ${bfcmInstruction}` : ""}

Requirements:
- This is a BLACK FRIDAY / CYBER MONDAY (BFCM) email — design it to feel premium, bold, high-stakes, and unmissable
- Use a dark, high-contrast palette (deep black or near-black background, sharp white text, a single vivid accent color such as electric red, neon yellow, or vibrant orange)
- Lead with a dramatic hero section: oversized headline${bfcmHeadline ? ` (use "${bfcmHeadline}" or a refined version)` : " announcing Black Friday / Cyber Monday"}, a 1–2 sentence subheading reinforcing the value, and a primary CTA button
- Display the promo code "${bfcmPromoCode}" prominently — render it inside a high-contrast, dashed-border code box that's easy to copy, with helper text such as "Use code at checkout"
- Make the discount "${bfcmDiscountValue}" the most visually dominant element after the headline — large, bold typography
${bfcmEndDate ? `- Reinforce strong urgency by clearly stating the sale ends ${bfcmEndDate}; use phrases like "Ends ${bfcmEndDate}" near the CTA, and consider a countdown-style block` : "- Convey strong urgency wording (e.g. \"Once it's gone, it's gone\", \"Limited time only\")"}
- Primary CTA button must link to ${landingPageUrl} with high-energy, action-oriented copy (e.g. "Grab the deal", "Shop BFCM now", "Claim your discount")
- Add a secondary, lower-emphasis link to the pricing page ${pricingPageUrl} (e.g. "View pricing")
- Include scarcity / FOMO framing where natural (best deal of the year, biggest discount we offer, etc.)
- Close with a final reminder of the promo code and end date${productLogoUrl ? `\n- Display the product logo at the top of the email using the provided URL: <img src="${productLogoUrl}" alt="${productName}" style="max-width:128px;height:auto;display:block;filter:brightness(0) invert(1);" /> (invert if needed so it reads on a dark background)` : ""}
- Use inline styles for email compatibility
- Make it responsive and visually polished — this should feel like the biggest sale of the year, not a routine promo${buildVariableHint()}`;

      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: "marketing",
          templateName: `${productName} BFCM Sale — ${bfcmPromoCode}`,
          templateSubject: bfcmHeadline || `BFCM: ${bfcmDiscountValue} off ${productName} with ${bfcmPromoCode}`,
          aiMode: "bfcm-sale",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        applyGenerated(data.html || "", data.subject, `${productName} BFCM Sale — ${bfcmPromoCode}`);
        toast.success("BFCM sale email generated!");
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

  const handleGenerateCeoOffer = async () => {
    if (!productName) { toast.error("Product name is required"); return; }
    if (!ceoName) { toast.error("CEO name is required"); return; }
    if (!ceoPromoCode) { toast.error("Promo code is required"); return; }
    if (!landingPageUrl) { toast.error("Landing page URL is required"); return; }
    if (!pricingPageUrl) { toast.error("Pricing page URL is required"); return; }

    setGenerating(true);
    try {
      const prompt = `Generate a CEOs Offer email for "${productName}".

CEO name: "${ceoName}"${ceoPhotoUrl ? `\nCEO photo: ${ceoPhotoUrl}` : ""}
Promo code: "${ceoPromoCode}"${ceoDiscountValue ? `\nDiscount: "${ceoDiscountValue}"` : ""}
${ceoHeadline ? `Headline/hook: "${ceoHeadline}"\n` : ""}Product landing page: ${landingPageUrl}
Pricing page: ${pricingPageUrl}${productLogoUrl ? `\nProduct logo: ${productLogoUrl}` : ""}

${ceoInstruction ? `Additional instructions: ${ceoInstruction}` : ""}

Requirements:
- This is a personal "letter from the CEO" style email — it should feel sincere, founder-led, and human, not corporate or templated
- Open with a warm, first-person greeting from ${ceoName} (e.g. "Hi {{firstName}}, ${ceoName} here —")
- Body should read like a short personal note from ${ceoName}: 2–4 short paragraphs, conversational tone, signed off personally at the end
${ceoPhotoUrl ? `- Include a circular CEO portrait near the signature using: <img src="${ceoPhotoUrl}" alt="${ceoName}" style="width:72px;height:72px;border-radius:50%;display:block;object-fit:cover;" />` : "- Leave space for a CEO portrait near the signature"}
- Sign off with the CEO's name "${ceoName}" and a "CEO, ${productName}" line
- Lead with a clear value proposition${ceoHeadline ? ` framed around "${ceoHeadline}" or a refined version` : ""}
- Display the promo code "${ceoPromoCode}" prominently — render it inside a dashed-border code box that's easy to copy, with helper text such as "Use code at checkout"
${ceoDiscountValue ? `- Make the discount "${ceoDiscountValue}" visually clear and tied to the promo code` : ""}
- Primary CTA button must link to ${landingPageUrl} with confident, action-oriented copy (e.g. "Claim your offer", "Get started")
- Add a secondary, lower-emphasis link to the pricing page ${pricingPageUrl} (e.g. "View pricing")
- Use a clean, premium, trust-building palette (white / off-white background, dark text, single accent color) — keep it understated; this is a personal offer, not a flashy sale
${productLogoUrl ? `- Display the product logo at the top of the email using: <img src="${productLogoUrl}" alt="${productName}" style="max-width:128px;height:auto;display:block;" />` : ""}
- Use inline styles for email compatibility
- Make it responsive and visually polished — this should feel like a one-to-one note from the CEO${buildVariableHint()}`;

      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          style: "professional",
          templateName: `${productName} CEOs Offer — ${ceoPromoCode}`,
          templateSubject: ceoHeadline || `A personal offer from ${ceoName} — ${ceoPromoCode}`,
          aiMode: "ceo-offer",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        applyGenerated(data.html || "", data.subject, `${productName} CEOs Offer — ${ceoPromoCode}`);
        toast.success("CEOs Offer email generated!");
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

  // Save campaign (always as draft on backend; status changes via the send endpoint).
  // When `existingCampaignId` is set we PUT the existing campaign; otherwise POST.
  async function persistCampaign(): Promise<string | null> {
    const url = existingCampaignId
      ? `/api/campaigns/${existingCampaignId}`
      : "/api/campaigns";
    const method = existingCampaignId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
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
        categoryId: categoryId || null,
        ...(existingCampaignId ? {} : { status: "draft" }),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Failed to save campaign");
      return null;
    }
    const data = await res.json();
    return (data.campaign?.id as string | undefined) ?? existingCampaignId;
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
        router.push(`/campaigns/swipeone/${id}`);
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
        router.push(`/campaigns/swipeone/${id}`);
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
    setSendProgress(null);
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    try {
      const id = await persistCampaign();
      if (!id) return;

      // Start polling progress immediately. The /progress endpoint reads
      // campaign.totalRecipients (set early in the send route) and counts
      // sent/failed CampaignEvent rows written by the bulk send loop.
      const pollProgress = async () => {
        try {
          const r = await fetch(`/api/campaigns/${id}/progress`);
          if (!r.ok) return;
          const p = (await r.json()) as {
            sent?: number;
            failed?: number;
            total?: number | null;
            status?: string;
          };
          setSendProgress({
            sent: p.sent ?? 0,
            failed: p.failed ?? 0,
            total: p.total ?? 0,
          });
        } catch {
          // ignore polling errors
        }
      };
      pollProgress();
      pollTimer = setInterval(pollProgress, 1500);

      const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
      // Final progress read so the bar reflects the post-send total.
      await pollProgress();

      if (res.ok) {
        toast.success("Campaign is being sent!");
        router.push(`/campaigns/swipeone/${id}`);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to send campaign");
      }
    } finally {
      if (pollTimer) clearInterval(pollTimer);
      setSending(false);
      setSendProgress(null);
    }
  };

  const openPreviewSend = () => {
    if (!htmlContent.trim()) {
      toast.error("Email content is empty");
      return;
    }
    if (!fromEmail) {
      toast.error("Set a sender email first");
      return;
    }
    // Pre-fill any vars from existing varValues, otherwise sensible defaults.
    const next: Record<string, string> = {};
    for (const v of detectedVars) {
      if (varValues[v]) {
        next[v] = varValues[v];
        continue;
      }
      const lc = v.toLowerCase();
      next[v] =
        lc === "email" ? "jane@example.com" :
        lc === "firstname" || lc === "first_name" ? "Jane" :
        lc === "lastname" || lc === "last_name" ? "Doe" :
        lc === "fullname" || lc === "full_name" ? "Jane Doe" :
        "";
    }
    setPreviewSendVarValues(next);
    setPreviewSendOpen(true);
  };

  const submitPreviewSend = async () => {
    const to = previewSendEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast.error("Enter a valid recipient email");
      return;
    }
    setSendingPreview(true);
    try {
      const res = await fetch("/api/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          htmlContent,
          fromEmail,
          fromName,
          varValues: previewSendVarValues,
        }),
      });
      if (res.ok) {
        toast.success(`Preview sent to ${to}`);
        setPreviewSendOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to send preview");
      }
    } catch {
      toast.error("Failed to send preview");
    } finally {
      setSendingPreview(false);
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
        {/* Section: Content */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              1. Email Content
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
            <Button
              type="button"
              variant={aiPanel === "product-security" ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => {
                const next = aiPanel === "product-security" ? "none" : "product-security";
                setAiPanel(next);
                if (next === "product-security" && securityPrompts.length === 0) fetchSavedPrompts("product-security");
              }}
            >
              <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
              Product Security Update
            </Button>
            <Button
              type="button"
              variant={aiPanel === "product-marketing" ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => {
                const next = aiPanel === "product-marketing" ? "none" : "product-marketing";
                setAiPanel(next);
                if (next === "product-marketing" && marketingPrompts.length === 0) fetchSavedPrompts("product-marketing");
              }}
            >
              <Megaphone className="h-3.5 w-3.5 mr-1.5" />
              Product Marketing Email With Screenshot
            </Button>
            <Button
              type="button"
              variant={aiPanel === "summer-sale" ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => {
                const next = aiPanel === "summer-sale" ? "none" : "summer-sale";
                setAiPanel(next);
                if (next === "summer-sale" && salePrompts.length === 0) fetchSavedPrompts("summer-sale");
              }}
            >
              <BadgePercent className="h-3.5 w-3.5 mr-1.5" />
              Summer Sale With PromoCode
            </Button>
            <Button
              type="button"
              variant={aiPanel === "bfcm-sale" ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => {
                const next = aiPanel === "bfcm-sale" ? "none" : "bfcm-sale";
                setAiPanel(next);
                if (next === "bfcm-sale" && bfcmPrompts.length === 0) fetchSavedPrompts("bfcm-sale");
              }}
            >
              <Tag className="h-3.5 w-3.5 mr-1.5" />
              BFCM Sale With PromoCode
            </Button>
            <Button
              type="button"
              variant={aiPanel === "ceo-offer" ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => {
                const next = aiPanel === "ceo-offer" ? "none" : "ceo-offer";
                setAiPanel(next);
                if (next === "ceo-offer" && ceoPrompts.length === 0) fetchSavedPrompts("ceo-offer");
              }}
            >
              <Crown className="h-3.5 w-3.5 mr-1.5" />
              CEOs Offer
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

              {productOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Load From Listed Products</Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={(v) => {
                      const id = v || "";
                      setSelectedProductId(id);
                      const p = productOptions.find((o) => o.id === id);
                      if (p) {
                        setProductName(p.name || "");
                        setProductLogoUrl(p.logoUrl || "");
                        setLandingPageUrl(p.landingPageUrl || "");
                        setPricingPageUrl(p.pricingPageUrl || "");
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Select a product to autofill the fields below">
                        {(value) => {
                          const id = typeof value === "string" ? value : "";
                          const p = productOptions.find((o) => o.id === id);
                          return p
                            ? p.name
                            : "Select a product to autofill the fields below";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Product Logo URL</Label>
                  <Input
                    placeholder="https://ps.w.org/{slug}/assets/icon-128x128.png"
                    value={productLogoUrl}
                    onChange={(e) => setProductLogoUrl(e.target.value)}
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

          {/* Product Security Update AI panel */}
          {aiPanel === "product-security" && (
            <div className="border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldAlert className="h-4 w-4" />
                  Product Security Update — AI Generator
                </div>
                <div className="flex items-center gap-2">
                  <Popover
                    open={securityResultsOpen}
                    onOpenChange={(open) => {
                      setSecurityResultsOpen(open);
                      if (open) fetchPreviousResults("product-security");
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
                        <p className="text-sm font-medium">Previous Results — Security Update</p>
                        <p className="text-xs text-muted-foreground">
                          AI-generated and saved templates. Click one to load.
                        </p>
                      </div>
                      <Separator />
                      <ScrollArea className="max-h-[360px]">
                        {securityResultsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : securityResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No saved results yet. Generate or save one first.
                          </p>
                        ) : (
                          <div className="p-1">
                            {securityResults.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  applyDynamicTemplate(t);
                                  setSecurityResultsOpen(false);
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
                    open={securityPromptsOpen}
                    onOpenChange={(open) => {
                      setSecurityPromptsOpen(open);
                      if (open && securityPrompts.length === 0) fetchSavedPrompts("product-security");
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
                        <p className="text-sm font-medium">Previous Prompts — Security Update</p>
                        <p className="text-xs text-muted-foreground">Click a prompt to fill the form</p>
                      </div>
                      <Separator />
                      <ScrollArea className="max-h-[360px]">
                        {securityPromptsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : securityPrompts.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No previous prompts yet for Product Security Update.
                          </p>
                        ) : (
                          <div className="p-1">
                            {securityPrompts.map((p) => (
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

              {productOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Load From Listed Products</Label>
                  <Select
                    value={selectedSecurityProductId}
                    onValueChange={(v) => {
                      const id = v || "";
                      setSelectedSecurityProductId(id);
                      const p = productOptions.find((o) => o.id === id);
                      if (p) {
                        setProductName(p.name || "");
                        setProductLogoUrl(p.logoUrl || "");
                        setLandingPageUrl(p.landingPageUrl || "");
                        setPricingPageUrl(p.pricingPageUrl || "");
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Select a product to autofill the fields below">
                        {(value) => {
                          const id = typeof value === "string" ? value : "";
                          const p = productOptions.find((o) => o.id === id);
                          return p
                            ? p.name
                            : "Select a product to autofill the fields below";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                    placeholder="e.g. 2.5.1"
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
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Product Logo URL</Label>
                  <Input
                    placeholder="https://ps.w.org/{slug}/assets/icon-128x128.png"
                    value={productLogoUrl}
                    onChange={(e) => setProductLogoUrl(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    Issues <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSecurityIssue}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Issue
                  </Button>
                </div>
                {securityIssues.map((item, index) => (
                  <div key={item.id} className="border p-3 space-y-2 bg-background">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Issue {index + 1}
                      </span>
                      {securityIssues.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeSecurityIssue(item.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Issue</Label>
                      <Textarea
                        placeholder="Describe the security issue (e.g. Stored XSS in comment field)"
                        value={item.issue}
                        onChange={(e) => updateSecurityIssue(item.id, "issue", e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Solution</Label>
                      <Textarea
                        placeholder="Describe how it was fixed in this release"
                        value={item.solution}
                        onChange={(e) => updateSecurityIssue(item.id, "solution", e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Additional Instructions (optional)</Label>
                <Textarea
                  placeholder="Tone, branding, severity context..."
                  value={securityInstruction}
                  onChange={(e) => setSecurityInstruction(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={handleGenerateProductSecurity}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldAlert className="mr-2 h-4 w-4" />
                )}
                {generating ? "Generating..." : "Generate product security update email"}
              </Button>
            </div>
          )}

          {/* Product Marketing Email With Screenshot AI panel */}
          {aiPanel === "product-marketing" && (
            <div className="border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Megaphone className="h-4 w-4" />
                  Product Marketing Email With Screenshot — AI Generator
                </div>
                <div className="flex items-center gap-2">
                  <Popover
                    open={marketingResultsOpen}
                    onOpenChange={(open) => {
                      setMarketingResultsOpen(open);
                      if (open) fetchPreviousResults("product-marketing");
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
                        <p className="text-sm font-medium">Previous Results — Marketing Email</p>
                        <p className="text-xs text-muted-foreground">
                          AI-generated and saved templates. Click one to load.
                        </p>
                      </div>
                      <Separator />
                      <ScrollArea className="max-h-[360px]">
                        {marketingResultsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : marketingResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No saved results yet. Generate or save one first.
                          </p>
                        ) : (
                          <div className="p-1">
                            {marketingResults.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  applyDynamicTemplate(t);
                                  setMarketingResultsOpen(false);
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
                    open={marketingPromptsOpen}
                    onOpenChange={(open) => {
                      setMarketingPromptsOpen(open);
                      if (open && marketingPrompts.length === 0) fetchSavedPrompts("product-marketing");
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
                        <p className="text-sm font-medium">Previous Prompts — Marketing Email</p>
                        <p className="text-xs text-muted-foreground">Click a prompt to fill the form</p>
                      </div>
                      <Separator />
                      <ScrollArea className="max-h-[360px]">
                        {marketingPromptsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : marketingPrompts.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No previous prompts yet for Marketing Email.
                          </p>
                        ) : (
                          <div className="p-1">
                            {marketingPrompts.map((p) => (
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

              {productOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Load From Listed Products</Label>
                  <Select
                    value={selectedMarketingProductId}
                    onValueChange={(v) => {
                      const id = v || "";
                      setSelectedMarketingProductId(id);
                      const p = productOptions.find((o) => o.id === id);
                      if (p) {
                        setProductName(p.name || "");
                        setProductLogoUrl(p.logoUrl || "");
                        setLandingPageUrl(p.landingPageUrl || "");
                        setPricingPageUrl(p.pricingPageUrl || "");
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Select a product to autofill the fields below">
                        {(value) => {
                          const id = typeof value === "string" ? value : "";
                          const p = productOptions.find((o) => o.id === id);
                          return p
                            ? p.name
                            : "Select a product to autofill the fields below";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                  <Label className="text-xs">Headline / Hook</Label>
                  <Input
                    placeholder="e.g. The fastest way to ship beautiful emails"
                    value={marketingHeadline}
                    onChange={(e) => setMarketingHeadline(e.target.value)}
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
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Product Logo URL</Label>
                  <Input
                    placeholder="https://ps.w.org/{slug}/assets/icon-128x128.png"
                    value={productLogoUrl}
                    onChange={(e) => setProductLogoUrl(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">
                    Highlights <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMarketingFeature}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Highlight
                  </Button>
                </div>
                {marketingFeatures.map((feature, index) => (
                  <div key={feature.id} className="border p-3 space-y-2 bg-background">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Highlight {index + 1}
                      </span>
                      {marketingFeatures.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeMarketingFeature(feature.id)}
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
                          alt={`Highlight ${index + 1}`}
                          className="max-h-[140px] border object-contain bg-white"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setMarketingFeatures((prev) =>
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
                            if (file) handleMarketingFeatureImageUpload(feature.id, file);
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
                      placeholder="Benefit-led caption — e.g. Send branded emails in seconds"
                      value={feature.caption}
                      onChange={(e) => updateMarketingFeatureCaption(feature.id, e.target.value)}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Additional Instructions (optional)</Label>
                <Textarea
                  placeholder="Brand voice, target audience, offers, color palette..."
                  value={marketingInstruction}
                  onChange={(e) => setMarketingInstruction(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={handleGenerateProductMarketing}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Megaphone className="mr-2 h-4 w-4" />
                )}
                {generating ? "Generating..." : "Generate product marketing email"}
              </Button>
            </div>
          )}

          {/* Summer Sale With PromoCode AI panel */}
          {aiPanel === "summer-sale" && (
            <div className="border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BadgePercent className="h-4 w-4" />
                  Summer Sale With PromoCode — AI Generator
                </div>
                <div className="flex items-center gap-2">
                  <Popover
                    open={saleResultsOpen}
                    onOpenChange={(open) => {
                      setSaleResultsOpen(open);
                      if (open) fetchPreviousResults("summer-sale");
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
                        <p className="text-sm font-medium">Previous Results — Summer Sale</p>
                        <p className="text-xs text-muted-foreground">
                          AI-generated and saved templates. Click one to load.
                        </p>
                      </div>
                      <Separator />
                      <ScrollArea className="max-h-[360px]">
                        {saleResultsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : saleResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No saved results yet. Generate or save one first.
                          </p>
                        ) : (
                          <div className="p-1">
                            {saleResults.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  applyDynamicTemplate(t);
                                  setSaleResultsOpen(false);
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
                    open={salePromptsOpen}
                    onOpenChange={(open) => {
                      setSalePromptsOpen(open);
                      if (open && salePrompts.length === 0) fetchSavedPrompts("summer-sale");
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
                        <p className="text-sm font-medium">Previous Prompts — Summer Sale</p>
                        <p className="text-xs text-muted-foreground">Click a prompt to fill the form</p>
                      </div>
                      <Separator />
                      <ScrollArea className="max-h-[360px]">
                        {salePromptsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : salePrompts.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No previous prompts yet for Summer Sale.
                          </p>
                        ) : (
                          <div className="p-1">
                            {salePrompts.map((p) => (
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

              {productOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Load From Listed Products</Label>
                  <Select
                    value={selectedSaleProductId}
                    onValueChange={(v) => {
                      const id = v || "";
                      setSelectedSaleProductId(id);
                      const p = productOptions.find((o) => o.id === id);
                      if (p) {
                        setProductName(p.name || "");
                        setProductLogoUrl(p.logoUrl || "");
                        setLandingPageUrl(p.landingPageUrl || "");
                        setPricingPageUrl(p.pricingPageUrl || "");
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Select a product to autofill the fields below">
                        {(value) => {
                          const id = typeof value === "string" ? value : "";
                          const p = productOptions.find((o) => o.id === id);
                          return p
                            ? p.name
                            : "Select a product to autofill the fields below";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                  <Label className="text-xs">Headline / Hook</Label>
                  <Input
                    placeholder="e.g. Summer is here — save big!"
                    value={saleHeadline}
                    onChange={(e) => setSaleHeadline(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Promo Code <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. SUMMER25"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="h-9 font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Discount <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. 25% off everything"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sale End Date</Label>
                  <Input
                    placeholder="e.g. August 31, 2026"
                    value={saleEndDate}
                    onChange={(e) => setSaleEndDate(e.target.value)}
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
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Product Logo URL</Label>
                  <Input
                    placeholder="https://ps.w.org/{slug}/assets/icon-128x128.png"
                    value={productLogoUrl}
                    onChange={(e) => setProductLogoUrl(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Additional Instructions (optional)</Label>
                <Textarea
                  placeholder="Brand voice, audience, accent colors, additional offers..."
                  value={saleInstruction}
                  onChange={(e) => setSaleInstruction(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={handleGenerateSummerSale}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BadgePercent className="mr-2 h-4 w-4" />
                )}
                {generating ? "Generating..." : "Generate summer sale email"}
              </Button>
            </div>
          )}

          {/* BFCM Sale With PromoCode AI panel */}
          {aiPanel === "bfcm-sale" && (
            <div className="border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-4 w-4" />
                  BFCM Sale With PromoCode — AI Generator
                </div>
                <div className="flex items-center gap-2">
                  <Popover
                    open={bfcmResultsOpen}
                    onOpenChange={(open) => {
                      setBfcmResultsOpen(open);
                      if (open) fetchPreviousResults("bfcm-sale");
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
                        <p className="text-sm font-medium">Previous Results — BFCM Sale</p>
                        <p className="text-xs text-muted-foreground">
                          AI-generated and saved templates. Click one to load.
                        </p>
                      </div>
                      <Separator />
                      <ScrollArea className="max-h-[360px]">
                        {bfcmResultsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : bfcmResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No saved results yet. Generate or save one first.
                          </p>
                        ) : (
                          <div className="p-1">
                            {bfcmResults.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  applyDynamicTemplate(t);
                                  setBfcmResultsOpen(false);
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
                    open={bfcmPromptsOpen}
                    onOpenChange={(open) => {
                      setBfcmPromptsOpen(open);
                      if (open && bfcmPrompts.length === 0) fetchSavedPrompts("bfcm-sale");
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
                        <p className="text-sm font-medium">Previous Prompts — BFCM Sale</p>
                        <p className="text-xs text-muted-foreground">Click a prompt to fill the form</p>
                      </div>
                      <Separator />
                      <ScrollArea className="max-h-[360px]">
                        {bfcmPromptsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : bfcmPrompts.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No previous prompts yet for BFCM Sale.
                          </p>
                        ) : (
                          <div className="p-1">
                            {bfcmPrompts.map((p) => (
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

              {productOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Load From Listed Products</Label>
                  <Select
                    value={selectedBfcmProductId}
                    onValueChange={(v) => {
                      const id = v || "";
                      setSelectedBfcmProductId(id);
                      const p = productOptions.find((o) => o.id === id);
                      if (p) {
                        setProductName(p.name || "");
                        setProductLogoUrl(p.logoUrl || "");
                        setLandingPageUrl(p.landingPageUrl || "");
                        setPricingPageUrl(p.pricingPageUrl || "");
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Select a product to autofill the fields below">
                        {(value) => {
                          const id = typeof value === "string" ? value : "";
                          const p = productOptions.find((o) => o.id === id);
                          return p
                            ? p.name
                            : "Select a product to autofill the fields below";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                  <Label className="text-xs">Headline / Hook</Label>
                  <Input
                    placeholder="e.g. Black Friday is here — biggest deal of the year"
                    value={bfcmHeadline}
                    onChange={(e) => setBfcmHeadline(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Promo Code <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. BFCM50"
                    value={bfcmPromoCode}
                    onChange={(e) => setBfcmPromoCode(e.target.value)}
                    className="h-9 font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Discount <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. 50% off everything"
                    value={bfcmDiscountValue}
                    onChange={(e) => setBfcmDiscountValue(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Sale End Date</Label>
                  <Input
                    placeholder="e.g. December 2, 2026"
                    value={bfcmEndDate}
                    onChange={(e) => setBfcmEndDate(e.target.value)}
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
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Product Logo URL</Label>
                  <Input
                    placeholder="https://ps.w.org/{slug}/assets/icon-128x128.png"
                    value={productLogoUrl}
                    onChange={(e) => setProductLogoUrl(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Additional Instructions (optional)</Label>
                <Textarea
                  placeholder="Brand voice, audience, accent colors, urgency framing..."
                  value={bfcmInstruction}
                  onChange={(e) => setBfcmInstruction(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={handleGenerateBfcmSale}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Tag className="mr-2 h-4 w-4" />
                )}
                {generating ? "Generating..." : "Generate BFCM sale email"}
              </Button>
            </div>
          )}

          {/* CEOs Offer AI panel */}
          {aiPanel === "ceo-offer" && (
            <div className="border p-3 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Crown className="h-4 w-4" />
                  CEOs Offer — AI Generator
                </div>
                <div className="flex items-center gap-2">
                  <Popover
                    open={ceoResultsOpen}
                    onOpenChange={(open) => {
                      setCeoResultsOpen(open);
                      if (open) fetchPreviousResults("ceo-offer");
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
                        <p className="text-sm font-medium">Previous Results — CEOs Offer</p>
                        <p className="text-xs text-muted-foreground">
                          AI-generated and saved templates. Click one to load.
                        </p>
                      </div>
                      <Separator />
                      <ScrollArea className="max-h-[360px]">
                        {ceoResultsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : ceoResults.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No saved results yet. Generate or save one first.
                          </p>
                        ) : (
                          <div className="p-1">
                            {ceoResults.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  applyDynamicTemplate(t);
                                  setCeoResultsOpen(false);
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
                    open={ceoPromptsOpen}
                    onOpenChange={(open) => {
                      setCeoPromptsOpen(open);
                      if (open && ceoPrompts.length === 0) fetchSavedPrompts("ceo-offer");
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
                        <p className="text-sm font-medium">Previous Prompts — CEOs Offer</p>
                        <p className="text-xs text-muted-foreground">Click a prompt to fill the form</p>
                      </div>
                      <Separator />
                      <ScrollArea className="max-h-[360px]">
                        {ceoPromptsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : ceoPrompts.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No previous prompts yet for CEOs Offer.
                          </p>
                        ) : (
                          <div className="p-1">
                            {ceoPrompts.map((p) => (
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

              {productOptions.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Load From Listed Products</Label>
                  <Select
                    value={selectedCeoProductId}
                    onValueChange={(v) => {
                      const id = v || "";
                      setSelectedCeoProductId(id);
                      const p = productOptions.find((o) => o.id === id);
                      if (p) {
                        setProductName(p.name || "");
                        setProductLogoUrl(p.logoUrl || "");
                        setLandingPageUrl(p.landingPageUrl || "");
                        setPricingPageUrl(p.pricingPageUrl || "");
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue placeholder="Select a product to autofill the fields below">
                        {(value) => {
                          const id = typeof value === "string" ? value : "";
                          const p = productOptions.find((o) => o.id === id);
                          return p
                            ? p.name
                            : "Select a product to autofill the fields below";
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {productOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

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
                  <Label className="text-xs">CEO Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Jane Doe"
                    value={ceoName}
                    onChange={(e) => setCeoName(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">CEO Photo URL</Label>
                  <Input
                    placeholder="https://example.com/ceo.jpg (square portrait works best)"
                    value={ceoPhotoUrl}
                    onChange={(e) => setCeoPhotoUrl(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Promo Code <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. CEO25"
                    value={ceoPromoCode}
                    onChange={(e) => setCeoPromoCode(e.target.value)}
                    className="h-9 font-mono uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Discount</Label>
                  <Input
                    placeholder="e.g. 25% off your first year"
                    value={ceoDiscountValue}
                    onChange={(e) => setCeoDiscountValue(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Headline / Hook</Label>
                  <Input
                    placeholder="e.g. A personal note from our CEO"
                    value={ceoHeadline}
                    onChange={(e) => setCeoHeadline(e.target.value)}
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
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Product Logo URL</Label>
                  <Input
                    placeholder="https://ps.w.org/{slug}/assets/icon-128x128.png"
                    value={productLogoUrl}
                    onChange={(e) => setProductLogoUrl(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Additional Instructions (optional)</Label>
                <Textarea
                  placeholder="Tone, founding story, audience, accent color..."
                  value={ceoInstruction}
                  onChange={(e) => setCeoInstruction(e.target.value)}
                  rows={2}
                />
              </div>

              <Button
                onClick={handleGenerateCeoOffer}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Crown className="mr-2 h-4 w-4" />
                )}
                {generating ? "Generating..." : "Generate CEOs Offer email"}
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
              <div className="flex items-center gap-2">
                <div className="flex items-center border divide-x">
                  {([3, 4, 5, 6] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => updateLibraryCols(n)}
                      className={cn(
                        "p-1 transition-colors",
                        libraryCols === n
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent"
                      )}
                      title={`${n} column${n > 1 ? "s" : ""}`}
                    >
                      {n === 3 && <Columns3 className="h-3.5 w-3.5" />}
                      {n === 4 && <Columns4 className="h-3.5 w-3.5" />}
                      {(n === 5 || n === 6) && (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1">
                          <Grid3x3 className="h-3 w-3" />
                          {n}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
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
              <ScrollArea className="h-[480px] border mt-1.5">
                <div className={cn("grid gap-2 p-2", libraryGridClass)}>
                  {dynamicLibrary.map((t) => (
                    <div
                      key={t.id}
                      className={cn(
                        "border bg-card flex flex-col overflow-hidden transition-colors",
                        selectedTemplate === t.id ? "ring-2 ring-primary" : ""
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setLibraryPreview(t)}
                        className="bg-white h-40 overflow-hidden relative group/thumb text-left border-b"
                        title="Click to preview"
                      >
                        {t.htmlContent ? (
                          <div
                            className="transform scale-[0.25] origin-top-left w-[400%] h-[400%] pointer-events-none"
                            dangerouslySetInnerHTML={{ __html: t.htmlContent }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                            No preview
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/thumb:opacity-100">
                          <span className="bg-white/90 text-foreground px-2 py-0.5 text-[10px] flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            Preview
                          </span>
                        </div>
                      </button>
                      <div className="p-2 flex flex-col gap-1.5 flex-1">
                        <p className="text-xs font-medium leading-tight line-clamp-2" title={t.name}>
                          {t.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge
                            variant={t.source === "manual" ? "default" : "secondary"}
                            className="text-[9px] px-1 py-0"
                          >
                            {t.source === "manual" ? "Saved" : "AI"}
                          </Badge>
                          {t.aiMode && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              {aiModeLabel(t.aiMode)}
                            </Badge>
                          )}
                        </div>
                        {t.subject && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1" title={t.subject}>
                            {t.subject}
                          </p>
                        )}
                        <p className="text-[9px] text-muted-foreground mt-auto">
                          {new Date(t.createdAt).toLocaleDateString()}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px] mt-1"
                          onClick={() => handleImportDynamicTemplate(t)}
                        >
                          <ArrowDownToLine className="h-3 w-3 mr-1" />
                          Import
                        </Button>
                      </div>
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

          {/* Send Preview dialog */}
          <Dialog open={previewSendOpen} onOpenChange={setPreviewSendOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Send Preview</DialogTitle>
                <DialogDescription>
                  Send a one-off copy of this email to a single address. Provide values for
                  any {`{{variables}}`} so the rendered email reflects how it will look for
                  a real recipient. The subject is prefixed with [Preview].
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Recipient email <span className="text-destructive">*</span></Label>
                  <Input
                    type="email"
                    value={previewSendEmail}
                    onChange={(e) => setPreviewSendEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-9"
                  />
                </div>
                {detectedVars.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Variable values{" "}
                      <span className="text-muted-foreground/70">
                        ({detectedVars.length})
                      </span>
                    </Label>
                    <ScrollArea className="max-h-[280px] border p-2">
                      <div className="space-y-2 pr-2">
                        {detectedVars.map((v) => (
                          <div
                            key={v}
                            className="grid grid-cols-[140px_1fr] gap-2 items-center"
                          >
                            <Label className="text-xs font-mono truncate" title={v}>
                              {`{{${v}}}`}
                            </Label>
                            <Input
                              value={previewSendVarValues[v] ?? ""}
                              onChange={(e) =>
                                setPreviewSendVarValues((prev) => ({
                                  ...prev,
                                  [v]: e.target.value,
                                }))
                              }
                              placeholder={`Sample value for ${v}`}
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreviewSendOpen(false)}
                  disabled={sendingPreview}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={submitPreviewSend}
                  disabled={sendingPreview || !previewSendEmail.trim()}
                >
                  {sendingPreview ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {sendingPreview ? "Sending..." : "Send Preview"}
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
                  {libraryPreview?.aiMode && ` — ${aiModeLabel(libraryPreview.aiMode)}`}
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

        {/* Section: Details */}
        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              2. Campaign Details
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
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs text-muted-foreground">
                Campaign Category{" "}
                <span className="text-muted-foreground/60">
                  (recipients can unsubscribe from this category specifically)
                </span>
              </Label>
              <Select
                value={categoryId}
                onValueChange={(v) => setCategoryId(v || "")}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue placeholder={
                    categoryOptions.length === 0
                      ? "No categories — add some in Settings → App Settings"
                      : "No category (general)"
                  }>
                    {(value) => {
                      const id = typeof value === "string" ? value : "";
                      const c = categoryOptions.find((o) => o.id === id);
                      return c ? c.name : "No category (general)";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Section: SwipeOne Segments */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              3. SwipeOne Segments
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
              4. Available SwipeOne Variables
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
        {sending && sendProgress && sendProgress.total > 0 && (
          <div className="flex-1 flex items-center gap-3 mr-2 min-w-0 max-w-md">
            <Progress
              value={Math.min(
                100,
                Math.round(
                  ((sendProgress.sent + sendProgress.failed) /
                    Math.max(sendProgress.total, 1)) *
                    100
                )
              )}
              className="flex-1 min-w-[120px]"
            />
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {sendProgress.sent + sendProgress.failed} / {sendProgress.total} sent
              {sendProgress.failed > 0 && (
                <span className="text-destructive ml-1">({sendProgress.failed} failed)</span>
              )}
            </span>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={openPreviewSend}
          disabled={sending}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Send Preview
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={handleSaveDraft}
          disabled={saving || sending}
        >
          {saving ? "Saving..." : "Save Draft"}
        </Button>
        {userRole === "super_admin" && (
          <Button size="sm" className="h-9" onClick={handleSendNow} disabled={sending}>
            {sending
              ? sendProgress && sendProgress.total > 0
                ? `Sending ${sendProgress.sent + sendProgress.failed}/${sendProgress.total}...`
                : "Sending..."
              : "Send Now"}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function SwipeOneCampaignNewPage() {
  return <SwipeOneCampaignEditor />;
}
