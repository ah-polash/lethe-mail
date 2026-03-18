"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailEditor, type EmailBlock } from "@/components/email-editor/editor";
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
  Upload,
  X,
  Users,
  Globe,
  Database,
  Layers,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SesIdentity {
  identity: string;
  type: string;
  verified: boolean;
}

interface Segment {
  _id: string;
  name: string;
}

interface Template {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  jsonContent: string;
}

interface Contact {
  id: string;
  email: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
}

interface Campaign {
  id: string;
  name: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  status: string;
  htmlContent: string;
  jsonContent: string;
  audienceSource: string;
  recipientEmails: string | null;
  totalRecipients: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplaints: number;
  totalUnsubscribed: number;
  createdAt: string;
  sentAt: string | null;
}

type AudienceSource = "swipeone" | "internal" | "segment";

const statusColors: Record<string, string> = {
  draft: "",
  scheduled: "border-blue-500 text-blue-600 dark:text-blue-400",
  sending: "border-yellow-500 text-yellow-600 dark:text-yellow-400",
  sent: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [userRole, setUserRole] = useState("");

  // Details
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [identities, setIdentities] = useState<SesIdentity[]>([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(false);

  // Audience
  const [audienceSource, setAudienceSource] = useState<AudienceSource>("internal");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentContactsLoading, setSegmentContactsLoading] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState("");

  // Internal contacts
  const [internalContacts, setInternalContacts] = useState<Contact[]>([]);
  const [internalContactsLoading, setInternalContactsLoading] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // Content
  const [htmlContent, setHtmlContent] = useState("");
  const [jsonContent, setJsonContent] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [editorBlocks, setEditorBlocks] = useState<EmailBlock[]>([]);

  // Load campaign + initial data
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUserRole(d.user?.role || ""))
      .catch(() => {});

    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {});

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

    async function fetchCampaign() {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`);
        if (!res.ok) {
          toast.error("Campaign not found");
          router.push("/campaigns");
          return;
        }
        const data = await res.json();
        const c = data.campaign as Campaign;
        setCampaign(c);
        setName(c.name);
        setSubject(c.subject || "");
        setFromEmail(c.fromEmail || "");
        setFromName(c.fromName || "");
        if (c.audienceSource) setAudienceSource(c.audienceSource as AudienceSource);
        setHtmlContent(c.htmlContent || "");
        setJsonContent(c.jsonContent || "");
        if (c.jsonContent) {
          try { setEditorBlocks(JSON.parse(c.jsonContent)); } catch { setEditorBlocks([]); }
        }
        if (c.recipientEmails) {
          try { setRecipientEmails(JSON.parse(c.recipientEmails)); } catch { /* ignore */ }
        }
      } catch {
        toast.error("Failed to load campaign");
      } finally {
        setPageLoading(false);
      }
    }
    fetchCampaign();
  }, [campaignId, router]);

  // Internal contacts
  const loadInternalContacts = useCallback(async () => {
    setInternalContactsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200", offset: "0" });
      if (internalSearch) params.set("search", internalSearch);
      const res = await fetch(`/api/contacts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setInternalContacts(data.contacts || []);
      }
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setInternalContactsLoading(false);
    }
  }, [internalSearch]);

  useEffect(() => {
    if (audienceSource === "internal" && campaign?.status === "draft") {
      loadInternalContacts();
    }
  }, [audienceSource, loadInternalContacts, campaign?.status]);

  const loadSegments = async () => {
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
      toast.error("Failed to load segments.");
    } finally {
      setSegmentsLoading(false);
    }
  };

  const toggleSegment = async (segmentId: string) => {
    if (selectedSegments.includes(segmentId)) {
      setSelectedSegments((prev) => prev.filter((id) => id !== segmentId));
      return;
    }
    setSelectedSegments((prev) => [...prev, segmentId]);
    setSegmentContactsLoading(true);
    try {
      const res = await fetch(`/api/swipeone/contacts?segmentId=${segmentId}`);
      if (res.ok) {
        const data = await res.json();
        const newEmails = (data.contacts || []).map((c: { email: string }) => c.email).filter(Boolean);
        setRecipientEmails((prev) => [...new Set([...prev, ...newEmails])]);
        toast.success(`${newEmails.length} contact(s) loaded`);
      }
    } catch { toast.error("Failed to load contacts from segment"); }
    finally { setSegmentContactsLoading(false); }
  };

  const toggleInternalContact = (contact: Contact) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(contact.id)) {
        next.delete(contact.id);
        setRecipientEmails((emails) => emails.filter((e) => e !== contact.email));
      } else {
        next.add(contact.id);
        setRecipientEmails((emails) => [...new Set([...emails, contact.email])]);
      }
      return next;
    });
  };

  const selectAllInternalContacts = () => {
    setSelectedContactIds(new Set(internalContacts.map((c) => c.id)));
    setRecipientEmails((prev) => [...new Set([...prev, ...internalContacts.map((c) => c.email).filter(Boolean)])]);
  };
  const deselectAllInternalContacts = () => {
    const contactEmails = new Set(internalContacts.map((c) => c.email));
    setSelectedContactIds(new Set());
    setRecipientEmails((prev) => prev.filter((e) => !contactEmails.has(e)));
  };

  const parseEmails = (text: string): string[] => {
    const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return [...new Set((text.match(regex) || []).map((e) => e.toLowerCase()))];
  };

  const addEmailsFromInput = () => {
    const newEmails = parseEmails(emailInput);
    if (newEmails.length === 0) { toast.error("No valid emails found"); return; }
    setRecipientEmails((prev) => [...new Set([...prev, ...newEmails])]);
    setEmailInput("");
    toast.success(`${newEmails.length} email(s) added`);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const newEmails = parseEmails(event.target?.result as string);
      if (newEmails.length === 0) { toast.error("No valid emails in file"); return; }
      setRecipientEmails((prev) => [...new Set([...prev, ...newEmails])]);
      toast.success(`${newEmails.length} email(s) imported`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const removeEmail = (email: string) => setRecipientEmails((prev) => prev.filter((e) => e !== email));
  const clearAllEmails = () => { setRecipientEmails([]); setSelectedContactIds(new Set()); setSelectedSegments([]); };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template.id);
    setHtmlContent(template.htmlContent || "");
    setJsonContent(template.jsonContent || "");
    if (template.jsonContent) { try { setEditorBlocks(JSON.parse(template.jsonContent)); } catch { setEditorBlocks([]); } }
    if (template.subject && !subject) setSubject(template.subject);
    toast.success(`Template "${template.name}" loaded`);
  };

  const handleEditorChange = (data: { html: string; json: string }) => {
    setHtmlContent(data.html);
    setJsonContent(data.json);
  };

  const handleSave = async () => {
    if (!name) { toast.error("Campaign name is required"); setActiveTab("details"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, fromEmail, fromName, htmlContent, jsonContent, recipientEmails, audienceSource }),
      });
      if (res.ok) {
        const data = await res.json();
        setCampaign(data.campaign);
        toast.success("Campaign updated");
      } else { toast.error("Failed to update campaign"); }
    } catch { toast.error("Failed to update campaign"); }
    finally { setSaving(false); }
  };

  const handleSend = async () => {
    if (!name || !subject || !fromEmail) { toast.error("Name, subject, and sender email are required"); setActiveTab("details"); return; }
    if (!htmlContent) { toast.error("Content is required"); setActiveTab("content"); return; }
    if (recipientEmails.length === 0) { toast.error("Add at least one recipient"); setActiveTab("details"); return; }

    // Save first, then send
    setSending(true);
    try {
      await fetch(`/api/campaigns/${campaignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, fromEmail, fromName, htmlContent, jsonContent, recipientEmails, audienceSource }),
      });
      const res = await fetch(`/api/campaigns/${campaignId}/send`, { method: "POST" });
      if (res.ok) {
        toast.success("Campaign is being sent!");
        router.push(`/campaigns/${campaignId}/report`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send");
      }
    } catch { toast.error("Failed to send campaign"); }
    finally { setSending(false); }
  };

  const allInternalSelected = internalContacts.length > 0 && internalContacts.every((c) => selectedContactIds.has(c.id));

  if (pageLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading campaign...</span>
      </div>
    );
  }

  if (!campaign) return null;

  const isDraft = campaign.status === "draft";

  // ── Read-only view for non-draft campaigns ───────────
  if (!isDraft) {
    return (
      <div className="flex flex-col -mx-6 lg:-mx-8 -mb-6 lg:-mb-8 -mt-16 lg:-mt-8 h-screen">
        <div className="flex-shrink-0 flex items-center justify-between px-6 lg:px-8 py-3 border-b bg-background">
          <div className="flex items-center gap-3">
            <Link href="/campaigns" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl font-semibold">{campaign.name}</h1>
            <Badge variant="secondary" className={statusColors[campaign.status] || ""}>{campaign.status}</Badge>
          </div>
          {campaign.status === "sent" && (
            <Link href={`/campaigns/${campaignId}/report`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}>
              View Report
            </Link>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-auto px-6 lg:px-8 py-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Subject</Label>
              <p className="text-sm font-medium">{campaign.subject || "N/A"}</p>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Recipients</Label>
              <p className="text-sm font-medium">{campaign.totalRecipients.toLocaleString()}</p>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Sent</Label>
              <p className="text-sm font-medium">{campaign.totalSent.toLocaleString()}</p>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Opens</Label>
              <p className="text-sm font-medium">{campaign.totalOpened.toLocaleString()}</p>
            </div>
          </div>
          {campaign.htmlContent && (
            <>
              <Separator />
              <div>
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Email Preview</Label>
                <div className="border p-4 bg-white max-h-[500px] overflow-auto">
                  <div dangerouslySetInnerHTML={{ __html: campaign.htmlContent }} className="max-w-[600px] mx-auto" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Draft edit view with full tabs ───────────────────
  return (
    <div className="flex flex-col -mx-6 lg:-mx-8 -mb-6 lg:-mb-8 -mt-16 lg:-mt-8 h-screen">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 lg:px-8 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold">Edit Campaign</h1>
          <Badge variant="secondary">draft</Badge>
        </div>
        <div className="flex items-center gap-2">
          {recipientEmails.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />{recipientEmails.length} recipient{recipientEmails.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="px-6 lg:px-8 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="details">1. Details & Audience</TabsTrigger>
              <TabsTrigger value="content">2. Content</TabsTrigger>
              <TabsTrigger value="review">3. Review</TabsTrigger>
            </TabsList>

            {/* Tab 1: Details & Audience */}
            <TabsContent value="details" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Campaign Name</Label>
                  <Input placeholder="e.g. March Newsletter" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email Subject</Label>
                  <Input placeholder="e.g. Your March Update" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From Email</Label>
                  {identitiesLoading ? (
                    <div className="flex items-center text-xs text-muted-foreground h-9"><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Loading...</div>
                  ) : identities.length === 0 ? (
                    <p className="text-xs text-muted-foreground h-9 flex items-center">No verified identities. Check AWS SES.</p>
                  ) : (
                    <Select value={fromEmail} onValueChange={(v) => v && setFromEmail(v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select verified identity" /></SelectTrigger>
                      <SelectContent>
                        {identities.map((id) => (<SelectItem key={id.identity} value={id.identity}>{id.identity}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From Name</Label>
                  <Input placeholder="e.g. Your Company" value={fromName} onChange={(e) => setFromName(e.target.value)} className="h-9" />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Audience Source</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => { setAudienceSource("swipeone"); if (segments.length === 0) loadSegments(); }}
                    className={cn("flex items-center gap-2 p-3 border text-left text-sm transition-colors", audienceSource === "swipeone" ? "border-primary bg-primary/5" : "hover:bg-accent")}>
                    <Globe className="h-4 w-4 shrink-0" />
                    <div><p className="font-medium text-xs">SwipeOne Segment</p><p className="text-[10px] text-muted-foreground">From SwipeOne CRM</p></div>
                  </button>
                  <button type="button" onClick={() => setAudienceSource("internal")}
                    className={cn("flex items-center gap-2 p-3 border text-left text-sm transition-colors", audienceSource === "internal" ? "border-primary bg-primary/5" : "hover:bg-accent")}>
                    <Database className="h-4 w-4 shrink-0" />
                    <div><p className="font-medium text-xs">Internal Contacts</p><p className="text-[10px] text-muted-foreground">From Contacts module</p></div>
                  </button>
                  <button type="button" disabled className="flex items-center gap-2 p-3 border text-left text-sm opacity-50 cursor-not-allowed">
                    <Layers className="h-4 w-4 shrink-0" />
                    <div><p className="font-medium text-xs">Contact Segment</p><p className="text-[10px] text-muted-foreground">Coming soon</p></div>
                  </button>
                </div>

                {audienceSource === "swipeone" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Segments</span>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadSegments} disabled={segmentsLoading}>
                        {segmentsLoading ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Loading...</> : "Refresh"}
                      </Button>
                    </div>
                    {segmentsLoading && segments.length === 0 ? (
                      <div className="flex items-center justify-center py-4 text-muted-foreground text-xs"><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Loading segments...</div>
                    ) : segments.length === 0 ? (
                      <p className="text-muted-foreground text-xs py-3 text-center">No segments found.</p>
                    ) : (
                      <ScrollArea className="h-[160px] border">
                        <div className="divide-y">
                          {segments.map((seg) => (
                            <div key={seg._id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors">
                              <Checkbox checked={selectedSegments.includes(seg._id)} onCheckedChange={() => toggleSegment(seg._id)} disabled={segmentContactsLoading} />
                              <label className="flex-1 cursor-pointer text-sm">{seg.name}</label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                    {segmentContactsLoading && <div className="flex items-center text-xs text-muted-foreground"><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Fetching contacts...</div>}
                  </div>
                )}

                {audienceSource === "internal" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input placeholder="Search contacts..." value={internalSearch} onChange={(e) => setInternalSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") loadInternalContacts(); }} className="h-8 flex-1 text-xs" />
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={loadInternalContacts} disabled={internalContactsLoading}>
                        {internalContactsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Search"}
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={allInternalSelected ? deselectAllInternalContacts : selectAllInternalContacts}>
                        {allInternalSelected ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                    {internalContactsLoading ? (
                      <div className="flex items-center justify-center py-4 text-muted-foreground text-xs"><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Loading...</div>
                    ) : internalContacts.length === 0 ? (
                      <p className="text-muted-foreground text-xs py-3 text-center">No contacts found.</p>
                    ) : (
                      <ScrollArea className="h-[160px] border">
                        <div className="divide-y">
                          {internalContacts.map((contact) => (
                            <div key={contact.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors">
                              <Checkbox checked={selectedContactIds.has(contact.id)} onCheckedChange={() => toggleInternalContact(contact)} />
                              <span className="text-xs flex-1 truncate">{contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email}</span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{contact.email}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                  <Textarea placeholder="Paste emails (comma or newline separated)" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} rows={2} className="text-xs" />
                  <div className="flex flex-col gap-1">
                    <Button size="sm" className="h-8 text-xs" onClick={addEmailsFromInput} disabled={!emailInput.trim()}>Add</Button>
                    <div className="relative">
                      <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                      <Button variant="outline" size="sm" className="h-8 text-xs w-full" type="button"><Upload className="mr-1 h-3 w-3" />CSV</Button>
                    </div>
                  </div>
                </div>

                {recipientEmails.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{recipientEmails.length} recipient{recipientEmails.length !== 1 ? "s" : ""}</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive" onClick={clearAllEmails}>Clear All</Button>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-[100px] overflow-auto p-2 border bg-muted/30">
                      {recipientEmails.map((email) => (
                        <Badge key={email} variant="secondary" className="text-[10px] h-5 gap-0.5 pr-0.5">
                          {email}
                          <button onClick={() => removeEmail(email)} className="ml-0.5 hover:bg-muted-foreground/20 p-0.5"><X className="h-2.5 w-2.5" /></button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab 2: Content */}
            <TabsContent value="content" className="mt-0 space-y-4">
              {templates.length > 0 && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Load from Template</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1.5">
                      {templates.map((t) => (
                        <button key={t.id} onClick={() => handleTemplateSelect(t)}
                          className={cn("p-2.5 border text-left text-xs hover:bg-accent transition-colors", selectedTemplate === t.id ? "border-primary bg-accent" : "")}>
                          <p className="font-medium truncate">{t.name}</p>
                          <p className="text-muted-foreground text-[10px] truncate">{t.subject || "No subject"}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}
              <EmailEditor initialBlocks={editorBlocks} onChange={handleEditorChange} />
            </TabsContent>

            {/* Tab 3: Review */}
            <TabsContent value="review" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Campaign Name</Label>
                  <p className="text-sm font-medium">{name || "Not set"}</p>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Subject</Label>
                  <p className="text-sm font-medium">{subject || "Not set"}</p>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">From</Label>
                  <p className="text-sm font-medium">{fromEmail ? `${fromName ? fromName + " " : ""}<${fromEmail}>` : "Not set"}</p>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Content</Label>
                  <p className="text-sm font-medium">{htmlContent ? "Ready" : "Not set"}</p>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Recipients</Label>
                  <p className="text-sm font-medium">{recipientEmails.length > 0 ? `${recipientEmails.length} recipient(s)` : "None added"}</p>
                </div>
              </div>
              {htmlContent && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 block">Email Preview</Label>
                    <div className="border p-4 bg-white max-h-[400px] overflow-auto">
                      <div dangerouslySetInnerHTML={{ __html: htmlContent }} className="max-w-[600px] mx-auto" />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 lg:px-8 py-3 border-t bg-background">
        <div>
          {activeTab !== "details" && (
            <Button variant="outline" size="sm" className="h-9" onClick={() => setActiveTab(activeTab === "review" ? "content" : "details")}>Back</Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          {activeTab === "review" && userRole === "super_admin" && (
            <Button size="sm" className="h-9" onClick={handleSend} disabled={sending}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {sending ? "Sending..." : "Send Now"}
            </Button>
          )}
          {activeTab !== "review" && (
            <Button size="sm" className="h-9" onClick={() => setActiveTab(activeTab === "details" ? "content" : "review")}>Next</Button>
          )}
        </div>
      </div>
    </div>
  );
}
