"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

type AudienceSource = "swipeone" | "internal" | "segment";

export default function NewCampaignPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Details
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [identities, setIdentities] = useState<SesIdentity[]>([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(false);

  // Audience (now in details tab)
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

  // User role
  const [userRole, setUserRole] = useState<string>("");

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
  }, []);

  // Load internal contacts
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
    if (audienceSource === "internal") {
      loadInternalContacts();
    }
  }, [audienceSource, loadInternalContacts]);

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
      toast.error("Failed to load segments. Check SwipeOne configuration.");
    } finally {
      setSegmentsLoading(false);
    }
  };

  const toggleSegment = async (segmentId: string) => {
    const isSelected = selectedSegments.includes(segmentId);
    if (isSelected) {
      setSelectedSegments((prev) => prev.filter((id) => id !== segmentId));
      return;
    }
    setSelectedSegments((prev) => [...prev, segmentId]);
    setSegmentContactsLoading(true);
    try {
      const res = await fetch(`/api/swipeone/contacts?segmentId=${segmentId}`);
      if (res.ok) {
        const data = await res.json();
        const newEmails = (data.contacts || [])
          .map((c: { email: string }) => c.email)
          .filter((e: string) => e);
        const combined = [...new Set([...recipientEmails, ...newEmails])];
        setRecipientEmails(combined);
        toast.success(`${newEmails.length} contact(s) loaded from segment`);
      } else {
        toast.error("Failed to load contacts from segment");
      }
    } catch {
      toast.error("Failed to load contacts from segment");
    } finally {
      setSegmentContactsLoading(false);
    }
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
    const allIds = new Set(internalContacts.map((c) => c.id));
    const allEmails = internalContacts.map((c) => c.email).filter(Boolean);
    setSelectedContactIds(allIds);
    setRecipientEmails((prev) => [...new Set([...prev, ...allEmails])]);
  };

  const deselectAllInternalContacts = () => {
    const contactEmails = new Set(internalContacts.map((c) => c.email));
    setSelectedContactIds(new Set());
    setRecipientEmails((prev) => prev.filter((e) => !contactEmails.has(e)));
  };

  const parseEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    return [...new Set(matches.map((e) => e.toLowerCase()))];
  };

  const addEmailsFromInput = () => {
    const newEmails = parseEmails(emailInput);
    if (newEmails.length === 0) {
      toast.error("No valid email addresses found");
      return;
    }
    const combined = [...new Set([...recipientEmails, ...newEmails])];
    setRecipientEmails(combined);
    setEmailInput("");
    toast.success(`${newEmails.length} email(s) added. Total: ${combined.length}`);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const newEmails = parseEmails(text);
      if (newEmails.length === 0) {
        toast.error("No valid email addresses found in file");
        return;
      }
      const combined = [...new Set([...recipientEmails, ...newEmails])];
      setRecipientEmails(combined);
      toast.success(`${newEmails.length} email(s) imported. Total: ${combined.length}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const removeEmail = (email: string) => {
    setRecipientEmails((prev) => prev.filter((e) => e !== email));
  };

  const clearAllEmails = () => {
    setRecipientEmails([]);
    setSelectedContactIds(new Set());
    setSelectedSegments([]);
    toast.success("All recipients cleared");
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template.id);
    setHtmlContent(template.htmlContent || "");
    setJsonContent(template.jsonContent || "");
    if (template.jsonContent) {
      try {
        setEditorBlocks(JSON.parse(template.jsonContent));
      } catch {
        setEditorBlocks([]);
      }
    }
    if (template.subject && !subject) {
      setSubject(template.subject);
    }
    toast.success(`Template "${template.name}" loaded`);
  };

  const handleEditorChange = (data: { html: string; json: string }) => {
    setHtmlContent(data.html);
    setJsonContent(data.json);
  };

  const handleSaveDraft = async () => {
    if (!name) {
      toast.error("Campaign name is required");
      setActiveTab("details");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, subject, fromEmail, fromName,
          htmlContent, jsonContent, recipientEmails, audienceSource, status: "draft",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Campaign saved as draft");
        router.push(`/campaigns/${data.campaign.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save campaign");
      }
    } catch {
      toast.error("Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    if (!name || !subject || !fromEmail) {
      toast.error("Campaign name, subject, and sender email are required");
      setActiveTab("details");
      return;
    }
    if (!htmlContent) {
      toast.error("Campaign content is required");
      setActiveTab("content");
      return;
    }
    if (recipientEmails.length === 0) {
      toast.error("Add at least one recipient");
      setActiveTab("details");
      return;
    }
    setSending(true);
    try {
      const saveRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, subject, fromEmail, fromName,
          htmlContent, jsonContent, recipientEmails, audienceSource, status: "draft",
        }),
      });
      if (!saveRes.ok) {
        toast.error("Failed to save campaign");
        return;
      }
      const saveData = await saveRes.json();
      const campaignId = saveData.campaign.id;
      const sendRes = await fetch(`/api/campaigns/${campaignId}/send`, { method: "POST" });
      if (sendRes.ok) {
        toast.success("Campaign is being sent!");
        router.push(`/campaigns/${campaignId}`);
      } else {
        const sendData = await sendRes.json();
        toast.error(sendData.error || "Failed to send campaign");
      }
    } catch {
      toast.error("Failed to send campaign");
    } finally {
      setSending(false);
    }
  };

  const allInternalSelected = internalContacts.length > 0 && internalContacts.every((c) => selectedContactIds.has(c.id));

  return (
    <div className="flex flex-col -mx-6 lg:-mx-8 -mb-6 lg:-mb-8 -mt-16 lg:-mt-8 h-screen">
      {/* ── Header (pinned) ────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 lg:px-8 py-3 border-b bg-background">
        <div className="flex items-center gap-3">
          <Link href="/campaigns" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8")}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold">New Campaign</h1>
        </div>
        <div className="flex items-center gap-2">
          {recipientEmails.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {recipientEmails.length} recipient{recipientEmails.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="px-6 lg:px-8 py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="details">1. Details & Audience</TabsTrigger>
              <TabsTrigger value="content">2. Content</TabsTrigger>
              <TabsTrigger value="review">3. Review</TabsTrigger>
            </TabsList>

            {/* ── Tab 1: Details & Audience ──────────────── */}
            <TabsContent value="details" className="mt-0 space-y-4">
              {/* Campaign fields – compact 2-col */}
              <div className="grid grid-cols-2 gap-3">
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

              <Separator />

              {/* Audience source selector */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Audience Source</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setAudienceSource("swipeone"); if (segments.length === 0) loadSegments(); }}
                    className={cn(
                      "flex items-center gap-2 p-3 border text-left text-sm transition-colors",
                      audienceSource === "swipeone" ? "border-primary bg-primary/5" : "hover:bg-accent"
                    )}
                  >
                    <Globe className="h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium text-xs">SwipeOne Segment</p>
                      <p className="text-[10px] text-muted-foreground">From SwipeOne CRM</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAudienceSource("internal")}
                    className={cn(
                      "flex items-center gap-2 p-3 border text-left text-sm transition-colors",
                      audienceSource === "internal" ? "border-primary bg-primary/5" : "hover:bg-accent"
                    )}
                  >
                    <Database className="h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium text-xs">Internal Contacts</p>
                      <p className="text-[10px] text-muted-foreground">From Contacts module</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-2 p-3 border text-left text-sm opacity-50 cursor-not-allowed"
                  >
                    <Layers className="h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-medium text-xs">Contact Segment</p>
                      <p className="text-[10px] text-muted-foreground">Coming soon</p>
                    </div>
                  </button>
                </div>

                {/* SwipeOne Segments */}
                {audienceSource === "swipeone" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Segments</span>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={loadSegments} disabled={segmentsLoading}>
                        {segmentsLoading ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Loading...</> : "Refresh"}
                      </Button>
                    </div>
                    {segmentsLoading && segments.length === 0 ? (
                      <div className="flex items-center justify-center py-4 text-muted-foreground text-xs">
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        Loading segments...
                      </div>
                    ) : segments.length === 0 ? (
                      <p className="text-muted-foreground text-xs py-3 text-center">
                        No segments found. Configure SwipeOne with a Workspace ID in Settings.
                      </p>
                    ) : (
                      <ScrollArea className="h-[160px] border">
                        <div className="divide-y">
                          {segments.map((segment) => (
                            <div key={segment._id} className="flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors">
                              <Checkbox
                                id={`seg-${segment._id}`}
                                checked={selectedSegments.includes(segment._id)}
                                onCheckedChange={() => toggleSegment(segment._id)}
                                disabled={segmentContactsLoading}
                              />
                              <label htmlFor={`seg-${segment._id}`} className="flex-1 cursor-pointer text-sm">
                                {segment.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                    {segmentContactsLoading && (
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        Fetching contacts from segment...
                      </div>
                    )}
                  </div>
                )}

                {/* Internal Contacts */}
                {audienceSource === "internal" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Search contacts..."
                        value={internalSearch}
                        onChange={(e) => setInternalSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") loadInternalContacts(); }}
                        className="h-8 flex-1 text-xs"
                      />
                      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={loadInternalContacts} disabled={internalContactsLoading}>
                        {internalContactsLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Search"}
                      </Button>
                      <Button
                        variant="outline" size="sm" className="h-8 text-xs"
                        onClick={allInternalSelected ? deselectAllInternalContacts : selectAllInternalContacts}
                      >
                        {allInternalSelected ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                    {internalContactsLoading ? (
                      <div className="flex items-center justify-center py-4 text-muted-foreground text-xs">
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        Loading contacts...
                      </div>
                    ) : internalContacts.length === 0 ? (
                      <p className="text-muted-foreground text-xs py-3 text-center">No contacts found.</p>
                    ) : (
                      <ScrollArea className="h-[160px] border">
                        <div className="divide-y">
                          {internalContacts.map((contact) => (
                            <div key={contact.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-accent transition-colors">
                              <Checkbox
                                checked={selectedContactIds.has(contact.id)}
                                onCheckedChange={() => toggleInternalContact(contact)}
                              />
                              <span className="text-xs flex-1 truncate">
                                {contact.fullName || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{contact.email}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}

                {/* Manual email entry + CSV – always visible */}
                <div className="grid grid-cols-[1fr_auto] gap-2 items-start">
                  <Textarea
                    placeholder="Paste emails (comma or newline separated)"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                  <div className="flex flex-col gap-1">
                    <Button size="sm" className="h-8 text-xs" onClick={addEmailsFromInput} disabled={!emailInput.trim()}>
                      Add
                    </Button>
                    <div className="relative">
                      <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="absolute inset-0 w-full opacity-0 cursor-pointer" />
                      <Button variant="outline" size="sm" className="h-8 text-xs w-full" type="button">
                        <Upload className="mr-1 h-3 w-3" />CSV
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Recipient summary */}
                {recipientEmails.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">{recipientEmails.length} recipient{recipientEmails.length !== 1 ? "s" : ""}</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive" onClick={clearAllEmails}>
                        Clear All
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-[100px] overflow-auto p-2 border bg-muted/30">
                      {recipientEmails.map((email) => (
                        <Badge key={email} variant="secondary" className="text-[10px] h-5 gap-0.5 pr-0.5">
                          {email}
                          <button onClick={() => removeEmail(email)} className="ml-0.5 hover:bg-muted-foreground/20 p-0.5">
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Tab 2: Content ─────────────────────────── */}
            <TabsContent value="content" className="mt-0 space-y-4">
              {templates.length > 0 && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Load from Template</Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1.5">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleTemplateSelect(t)}
                          className={cn(
                            "p-2.5 border text-left text-xs hover:bg-accent transition-colors",
                            selectedTemplate === t.id ? "border-primary bg-accent" : ""
                          )}
                        >
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

            {/* ── Tab 3: Review ──────────────────────────── */}
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
                  <p className="text-sm font-medium">
                    {fromEmail ? `${fromName ? fromName + " " : ""}<${fromEmail}>` : "Not set"}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Content</Label>
                  <p className="text-sm font-medium">{htmlContent ? "Ready" : "Not set"}</p>
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Recipients</Label>
                  <p className="text-sm font-medium">
                    {recipientEmails.length > 0 ? `${recipientEmails.length} recipient(s)` : "None added"}
                  </p>
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

      {/* ── Footer (pinned) ────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 lg:px-8 py-3 border-t bg-background">
        <div>
          {activeTab !== "details" && (
            <Button
              variant="outline" size="sm" className="h-9"
              onClick={() => setActiveTab(activeTab === "review" ? "content" : "details")}
            >
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={handleSaveDraft} disabled={saving}>
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          {activeTab === "review" && userRole === "super_admin" && (
            <Button size="sm" className="h-9" onClick={handleSendNow} disabled={sending}>
              {sending ? "Sending..." : "Send Now"}
            </Button>
          )}
          {activeTab !== "review" && (
            <Button size="sm" className="h-9" onClick={() => setActiveTab(activeTab === "details" ? "content" : "review")}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
