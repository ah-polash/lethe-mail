"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  Heading,
  Type,
  Image,
  MousePointer,
  Minus,
  MoveVertical,
  Columns,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ---- Contact Properties for Dynamic Values ----
const CONTACT_PROPERTIES: { label: string; name: string }[] = [
  { label: "Full Name", name: "fullName" },
  { label: "Email", name: "email" },
  { label: "First Name", name: "firstName" },
  { label: "Last Name", name: "lastName" },
  { label: "Tags", name: "tags" },
  { label: "Phone Number", name: "phone" },
  { label: "Birthday", name: "birthday" },
  { label: "Gender", name: "gender" },
  { label: "Occupation", name: "occupation" },
  { label: "Language", name: "language" },
  { label: "Timezone", name: "timezone" },
  { label: "Country", name: "country" },
  { label: "Address", name: "address" },
  { label: "Website", name: "website" },
  { label: "LinkedIn", name: "linkedin" },
  { label: "Facebook", name: "facebook" },
  { label: "Twitter", name: "twitter" },
  { label: "Browser", name: "browser" },
  { label: "Device", name: "device" },
  { label: "Contact Source", name: "contactSource" },
  { label: "Job Title", name: "jobTitle" },
  { label: "Department", name: "department" },
  { label: "Annual Income", name: "annualIncome" },
  { label: "Annual Revenue", name: "annualRevenue" },
  { label: "Customer Lifetime Value", name: "customerLifetimeValue" },
  { label: "Team Size", name: "teamSize" },
  { label: "NPS Score", name: "nps_score" },
  { label: "Is Marketing Allowed", name: "is_marketing_allowed" },
  { label: "Is Verified", name: "is_verified" },
  { label: "Email Status", name: "email_status" },
  { label: "Email Verification Status", name: "email_verification_status" },
  { label: "Email Marketing Consent", name: "marketing_email_subscription_status" },
  { label: "Marketing Contact Status", name: "marketing_contact_status" },
  { label: "Event Type", name: "event_type" },
  { label: "Plugin ID", name: "plugin_id" },
  { label: "Plugin Slug", name: "plugin_name" },
  { label: "Product Name", name: "product_name" },
  { label: "Platform", name: "platform" },
  { label: "Feed", name: "feed" },
  { label: "Orders Count", name: "orders_count" },
  { label: "Total Spent", name: "total_spent" },
  { label: "Average Order Value", name: "average_order_value" },
  { label: "First Purchase Date", name: "first_purchase_date" },
  { label: "Last Purchase Date", name: "last_purchase_date" },
  { label: "Last Abandoned Date", name: "last_abandoned_date" },
  { label: "MRR", name: "mrr" },
  { label: "Subscription Activated Date", name: "subscription_activated_date" },
  { label: "Subscription Created Date", name: "subscription_created_date" },
  { label: "Subscription Cancelled Date", name: "subscription_cancelled_date" },
  { label: "Trial Start Date", name: "trial_start_date" },
  { label: "Trial End Date", name: "trial_end_date" },
  { label: "Next Billing Date", name: "next_billing_date" },
  { label: "Last Activity Date", name: "lastActivityDate" },
  { label: "Uninstall Feedback", name: "uninstall_feedback" },
  { label: "Uninstall Reason ID", name: "uninstall_reason_id" },
  { label: "Feedback Text", name: "feedback_text" },
  { label: "Created Date", name: "createdAt" },
  { label: "Last Updated Date", name: "updatedAt" },
];

export type DynamicField = { label: string; name: string };

// Merge two property lists, preferring entries from `extra` and de-duping by name
function mergeProperties(
  base: DynamicField[],
  extra?: DynamicField[]
): DynamicField[] {
  if (!extra || extra.length === 0) return base;
  const byName = new Map<string, DynamicField>();
  for (const p of base) byName.set(p.name, p);
  for (const p of extra) byName.set(p.name, p);
  return Array.from(byName.values());
}

// ---- Slash Command Textarea ----
function SlashCommandTextarea({
  value,
  onChange,
  className,
  placeholder,
  rows,
  singleLine,
  dynamicFields,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
  singleLine?: boolean;
  dynamicFields?: DynamicField[];
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [filter, setFilter] = useState("");
  const [menuIndex, setMenuIndex] = useState(0);
  const [slashPos, setSlashPos] = useState<number | null>(null);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const properties = mergeProperties(CONTACT_PROPERTIES, dynamicFields);
  const filtered = properties.filter(
    (p) =>
      p.label.toLowerCase().includes(filter.toLowerCase()) ||
      p.name.toLowerCase().includes(filter.toLowerCase())
  );

  const insertProperty = useCallback(
    (prop: { name: string }) => {
      if (slashPos === null) return;
      const before = value.slice(0, slashPos);
      const afterSlash = value.slice(slashPos);
      // find where the slash+filter ends
      const match = afterSlash.match(/^\/[^\s]*/);
      const replaceLen = match ? match[0].length : 1;
      const after = value.slice(slashPos + replaceLen);
      const tag = `{{${prop.name}}}`;
      const newValue = before + tag + after;
      onChange(newValue);
      setShowMenu(false);
      setFilter("");
      setSlashPos(null);
      // restore focus
      setTimeout(() => {
        const el = ref.current;
        if (el) {
          el.focus();
          const cursorPos = before.length + tag.length;
          el.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    },
    [value, slashPos, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showMenu) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMenuIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMenuIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (filtered.length > 0) {
        e.preventDefault();
        insertProperty(filtered[menuIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowMenu(false);
      setFilter("");
      setSlashPos(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(newValue);

    // Check if we should show/update the slash menu
    // Look backwards from cursor to find a `/`
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastSlash = textBeforeCursor.lastIndexOf("/");

    if (lastSlash !== -1) {
      const textBetween = textBeforeCursor.slice(lastSlash + 1);
      // Only show menu if no spaces in the filter (user is still typing the command)
      if (!/\s/.test(textBetween)) {
        setSlashPos(lastSlash);
        setFilter(textBetween);
        setShowMenu(true);
        setMenuIndex(0);
        return;
      }
    }
    setShowMenu(false);
    setFilter("");
    setSlashPos(null);
  };

  // Scroll active item into view
  useEffect(() => {
    if (showMenu && menuRef.current) {
      const active = menuRef.current.querySelector("[data-active='true']");
      if (active) active.scrollIntoView({ block: "nearest" });
    }
  }, [menuIndex, showMenu]);

  const sharedProps = {
    ref: ref as React.RefObject<HTMLTextAreaElement & HTMLInputElement>,
    value,
    onChange: handleChange,
    onKeyDown: handleKeyDown,
    placeholder,
  };

  return (
    <div className="relative">
      {singleLine ? (
        <input
          {...sharedProps}
          className={cn("flex h-9 w-full border bg-background px-3 py-1 text-sm", className)}
        />
      ) : (
        <textarea
          {...sharedProps}
          rows={rows || 3}
          className={cn("w-full min-h-[80px] border bg-background px-3 py-2 text-sm resize-y", className)}
        />
      )}
      {showMenu && filtered.length > 0 && (
        <div
          ref={menuRef}
          className="absolute z-50 left-0 right-0 mt-1 border bg-popover text-popover-foreground shadow-md max-h-[240px] overflow-auto"
        >
          <div className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-semibold border-b bg-muted/50">
            Contact Properties
          </div>
          {filtered.map((prop, i) => (
            <button
              key={prop.name}
              type="button"
              data-active={i === menuIndex}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 text-xs cursor-pointer transition-colors",
                i === menuIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertProperty(prop);
              }}
              onMouseEnter={() => setMenuIndex(i)}
            >
              <span>{prop.label}</span>
              <code className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5">{`{{${prop.name}}}`}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Block Types ----
export interface EmailBlock {
  id: string;
  type:
    | "heading"
    | "text"
    | "image"
    | "button"
    | "divider"
    | "spacer"
    | "columns";
  props: Record<string, string | number | EmailBlock[][]>;
}

interface BlockType {
  type: EmailBlock["type"];
  label: string;
  icon: React.ElementType;
}

const BLOCK_TYPES: BlockType[] = [
  { type: "heading", label: "Heading", icon: Heading },
  { type: "text", label: "Text", icon: Type },
  { type: "image", label: "Image", icon: Image },
  { type: "button", label: "Button", icon: MousePointer },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "spacer", label: "Spacer", icon: MoveVertical },
  { type: "columns", label: "Columns", icon: Columns },
];

let blockIdCounter = 0;
function generateId() {
  return `block-${Date.now()}-${++blockIdCounter}`;
}

function createBlock(type: EmailBlock["type"]): EmailBlock {
  const id = generateId();
  const defaults: Record<string, Record<string, string | number | EmailBlock[][]>> = {
    heading: {
      content: "Heading",
      fontSize: 28,
      color: "#000000",
      textAlign: "center",
      fontWeight: "bold",
      padding: 10,
      backgroundColor: "",
    },
    text: {
      content: "Write your text here...",
      fontSize: 16,
      color: "#333333",
      textAlign: "left",
      lineHeight: 1.5,
      padding: 10,
      backgroundColor: "",
    },
    image: {
      src: "https://placehold.co/600x200/e2e8f0/64748b?text=Your+Image",
      alt: "Image",
      width: 600,
      padding: 10,
      alignment: "center",
      linkUrl: "",
    },
    button: {
      content: "Click Here",
      linkUrl: "#",
      backgroundColor: "#000000",
      color: "#ffffff",
      fontSize: 16,
      padding: 10,
      borderRadius: 6,
      alignment: "center",
    },
    divider: {
      color: "#e2e8f0",
      thickness: 1,
      padding: 10,
    },
    spacer: {
      height: 30,
    },
    columns: {
      columns: [[], []] as EmailBlock[][],
      padding: 10,
    },
  };
  return { id, type, props: { ...defaults[type] } };
}

// ---- HTML Generation ----
function blockToHtml(block: EmailBlock): string {
  const p = block.props;
  const padding = `${p.padding || 0}px`;

  switch (block.type) {
    case "heading":
      return `<tr><td style="padding:${padding};background-color:${p.backgroundColor || "transparent"};text-align:${p.textAlign};font-size:${p.fontSize}px;color:${p.color};font-weight:${p.fontWeight};font-family:Arial,sans-serif;">${String(p.content).replace(/\n/g, "<br>")}</td></tr>`;

    case "text":
      return `<tr><td style="padding:${padding};background-color:${p.backgroundColor || "transparent"};text-align:${p.textAlign};font-size:${p.fontSize}px;color:${p.color};line-height:${p.lineHeight};font-family:Arial,sans-serif;">${String(p.content).replace(/\n/g, "<br>")}</td></tr>`;

    case "image": {
      const img = `<img src="${p.src}" alt="${p.alt}" width="${p.width}" style="max-width:100%;height:auto;display:block;${p.alignment === "center" ? "margin:0 auto;" : ""}" />`;
      const linked = p.linkUrl ? `<a href="${p.linkUrl}" target="_blank">${img}</a>` : img;
      return `<tr><td style="padding:${padding};text-align:${p.alignment};">${linked}</td></tr>`;
    }

    case "button": {
      return `<tr><td style="padding:${padding};text-align:${p.alignment};"><table border="0" cellpadding="0" cellspacing="0" role="presentation" style="${p.alignment === "center" ? "margin:0 auto;" : ""}"><tr><td style="background-color:${p.backgroundColor};border-radius:${p.borderRadius}px;padding:12px 24px;"><a href="${p.linkUrl}" target="_blank" style="color:${p.color};font-size:${p.fontSize}px;font-family:Arial,sans-serif;text-decoration:none;display:inline-block;font-weight:bold;">${p.content}</a></td></tr></table></td></tr>`;
    }

    case "divider":
      return `<tr><td style="padding:${padding};"><hr style="border:none;border-top:${p.thickness}px solid ${p.color};margin:0;" /></td></tr>`;

    case "spacer":
      return `<tr><td style="height:${p.height}px;font-size:0;line-height:0;">&nbsp;</td></tr>`;

    case "columns": {
      const cols = p.columns as EmailBlock[][];
      const colCount = cols.length || 2;
      const widthPct = Math.floor(100 / colCount);
      const colHtml = cols
        .map(
          (col) =>
            `<td valign="top" width="${widthPct}%" style="padding:5px;"><table width="100%" cellpadding="0" cellspacing="0" border="0">${col.map(blockToHtml).join("")}</table></td>`
        )
        .join("");
      return `<tr><td style="padding:${padding};"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${colHtml}</tr></table></td></tr>`;
    }

    default:
      return "";
  }
}

function blocksToHtml(blocks: EmailBlock[]): string {
  const rows = blocks.map(blockToHtml).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Email</title>
<!--[if mso]>
<style type="text/css">
  table {border-collapse:collapse;border-spacing:0;margin:0;}
  div, td {padding:0;}
  div {margin:0 !important;}
</style>
<noscript>
<xml>
  <o:OfficeDocumentSettings>
    <o:PixelsPerInch>96</o:PixelsPerInch>
  </o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style type="text/css">
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; }
    .fluid { max-width: 100% !important; height: auto !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
<center>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f5;">
<tr>
<td align="center" valign="top">
<table class="email-container" role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
${rows}
</table>
</td>
</tr>
</table>
</center>
</body>
</html>`;
}

// ---- Block Preview Component ----
function BlockPreview({
  block,
  isSelected,
  onClick,
}: {
  block: EmailBlock;
  isSelected: boolean;
  onClick: () => void;
}) {
  const p = block.props;

  const renderContent = () => {
    switch (block.type) {
      case "heading":
        return (
          <div
            style={{
              fontSize: `${p.fontSize}px`,
              color: p.color as string,
              textAlign: p.textAlign as "left" | "center" | "right",
              fontWeight: p.fontWeight as string,
              padding: `${p.padding}px`,
              backgroundColor: (p.backgroundColor as string) || undefined,
            }}
          >
            {p.content as string}
          </div>
        );
      case "text":
        return (
          <div
            style={{
              fontSize: `${p.fontSize}px`,
              color: p.color as string,
              textAlign: p.textAlign as "left" | "center" | "right",
              lineHeight: p.lineHeight as number,
              padding: `${p.padding}px`,
              backgroundColor: (p.backgroundColor as string) || undefined,
            }}
          >
            {p.content as string}
          </div>
        );
      case "image":
        return (
          <div
            style={{
              padding: `${p.padding}px`,
              textAlign: p.alignment as "left" | "center" | "right",
            }}
          >
            <img
              src={p.src as string}
              alt={p.alt as string}
              style={{
                maxWidth: "100%",
                width: `${p.width}px`,
                height: "auto",
              }}
            />
          </div>
        );
      case "button":
        return (
          <div
            style={{
              padding: `${p.padding}px`,
              textAlign: p.alignment as "left" | "center" | "right",
            }}
          >
            <span
              style={{
                display: "inline-block",
                backgroundColor: p.backgroundColor as string,
                color: p.color as string,
                fontSize: `${p.fontSize}px`,
                padding: "12px 24px",
                borderRadius: `${p.borderRadius}px`,
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {p.content as string}
            </span>
          </div>
        );
      case "divider":
        return (
          <div style={{ padding: `${p.padding}px` }}>
            <hr
              style={{
                border: "none",
                borderTop: `${p.thickness}px solid ${p.color}`,
                margin: 0,
              }}
            />
          </div>
        );
      case "spacer":
        return (
          <div
            style={{ height: `${p.height}px` }}
            className="bg-muted/30 flex items-center justify-center"
          >
            <span className="text-xs text-muted-foreground">
              {p.height as number}px spacer
            </span>
          </div>
        );
      case "columns": {
        const cols = p.columns as EmailBlock[][];
        return (
          <div
            style={{ padding: `${p.padding}px`, display: "grid", gridTemplateColumns: `repeat(${cols.length}, 1fr)`, gap: "8px" }}
          >
            {cols.map((col, i) => (
              <div key={i} className="border border-dashed rounded p-2 min-h-[60px]">
                {col.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Column {i + 1}
                  </p>
                ) : (
                  col.map((b) => (
                    <BlockPreview
                      key={b.id}
                      block={b}
                      isSelected={false}
                      onClick={() => {}}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "relative cursor-pointer transition-all",
        isSelected
          ? "ring-2 ring-primary ring-offset-2 rounded"
          : "hover:ring-1 hover:ring-muted-foreground/30 rounded"
      )}
    >
      {renderContent()}
    </div>
  );
}

// ---- Properties Panel ----
function PropertiesPanel({
  block,
  onChange,
  onDelete,
  dynamicFields,
}: {
  block: EmailBlock;
  onChange: (props: Record<string, string | number | EmailBlock[][]>) => void;
  onDelete: () => void;
  dynamicFields?: DynamicField[];
}) {
  const p = block.props;

  const updateProp = (key: string, value: string | number) => {
    onChange({ ...p, [key]: value });
  };

  const renderFields = () => {
    switch (block.type) {
      case "heading":
      case "text":
        return (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Content <span className="text-muted-foreground font-normal">— type / for dynamic values</span></Label>
              <SlashCommandTextarea
                value={p.content as string}
                onChange={(v) => updateProp("content", v)}
                dynamicFields={dynamicFields}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Font Size</Label>
                <Input
                  type="number"
                  value={p.fontSize as number}
                  onChange={(e) => updateProp("fontSize", parseInt(e.target.value) || 16)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    value={p.color as string}
                    onChange={(e) => updateProp("color", e.target.value)}
                    className="h-9 w-9 rounded border cursor-pointer"
                  />
                  <Input
                    value={p.color as string}
                    onChange={(e) => updateProp("color", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Text Align</Label>
              <Select
                value={p.textAlign as string}
                onValueChange={(v) => v && updateProp("textAlign", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Padding (px)</Label>
                <Input
                  type="number"
                  value={p.padding as number}
                  onChange={(e) => updateProp("padding", parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Background</Label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    value={(p.backgroundColor as string) || "#ffffff"}
                    onChange={(e) => updateProp("backgroundColor", e.target.value)}
                    className="h-9 w-9 rounded border cursor-pointer"
                  />
                  <Input
                    value={(p.backgroundColor as string) || ""}
                    onChange={(e) => updateProp("backgroundColor", e.target.value)}
                    placeholder="none"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </>
        );

      case "image":
        return (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Image URL</Label>
              <Input
                value={p.src as string}
                onChange={(e) => updateProp("src", e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alt Text</Label>
              <Input
                value={p.alt as string}
                onChange={(e) => updateProp("alt", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Width (px)</Label>
                <Input
                  type="number"
                  value={p.width as number}
                  onChange={(e) => updateProp("width", parseInt(e.target.value) || 600)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Padding (px)</Label>
                <Input
                  type="number"
                  value={p.padding as number}
                  onChange={(e) => updateProp("padding", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alignment</Label>
              <Select
                value={p.alignment as string}
                onValueChange={(v) => v && updateProp("alignment", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Link URL</Label>
              <Input
                value={p.linkUrl as string}
                onChange={(e) => updateProp("linkUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>
          </>
        );

      case "button":
        return (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Button Text <span className="text-muted-foreground font-normal">— type / for dynamic values</span></Label>
              <SlashCommandTextarea
                value={p.content as string}
                onChange={(v) => updateProp("content", v)}
                singleLine
                dynamicFields={dynamicFields}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Link URL</Label>
              <Input
                value={p.linkUrl as string}
                onChange={(e) => updateProp("linkUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">BG Color</Label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    value={p.backgroundColor as string}
                    onChange={(e) => updateProp("backgroundColor", e.target.value)}
                    className="h-9 w-9 rounded border cursor-pointer"
                  />
                  <Input
                    value={p.backgroundColor as string}
                    onChange={(e) => updateProp("backgroundColor", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Text Color</Label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    value={p.color as string}
                    onChange={(e) => updateProp("color", e.target.value)}
                    className="h-9 w-9 rounded border cursor-pointer"
                  />
                  <Input
                    value={p.color as string}
                    onChange={(e) => updateProp("color", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Font Size</Label>
                <Input
                  type="number"
                  value={p.fontSize as number}
                  onChange={(e) => updateProp("fontSize", parseInt(e.target.value) || 16)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Border Radius</Label>
                <Input
                  type="number"
                  value={p.borderRadius as number}
                  onChange={(e) => updateProp("borderRadius", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alignment</Label>
              <Select
                value={p.alignment as string}
                onValueChange={(v) => v && updateProp("alignment", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Padding (px)</Label>
              <Input
                type="number"
                value={p.padding as number}
                onChange={(e) => updateProp("padding", parseInt(e.target.value) || 0)}
              />
            </div>
          </>
        );

      case "divider":
        return (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    value={p.color as string}
                    onChange={(e) => updateProp("color", e.target.value)}
                    className="h-9 w-9 rounded border cursor-pointer"
                  />
                  <Input
                    value={p.color as string}
                    onChange={(e) => updateProp("color", e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Thickness (px)</Label>
                <Input
                  type="number"
                  value={p.thickness as number}
                  onChange={(e) => updateProp("thickness", parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Padding (px)</Label>
              <Input
                type="number"
                value={p.padding as number}
                onChange={(e) => updateProp("padding", parseInt(e.target.value) || 0)}
              />
            </div>
          </>
        );

      case "spacer":
        return (
          <div className="space-y-1">
            <Label className="text-xs">Height (px)</Label>
            <Input
              type="number"
              value={p.height as number}
              onChange={(e) => updateProp("height", parseInt(e.target.value) || 10)}
            />
          </div>
        );

      case "columns":
        return (
          <div className="space-y-1">
            <Label className="text-xs">Padding (px)</Label>
            <Input
              type="number"
              value={p.padding as number}
              onChange={(e) => updateProp("padding", parseInt(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Column content is edited inline. Drag blocks into each column on the canvas.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium capitalize">{block.type} Properties</h4>
        <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <Separator />
      {renderFields()}
    </div>
  );
}

// ---- Main Editor Component ----
interface EmailEditorProps {
  initialBlocks?: EmailBlock[];
  onChange?: (data: { html: string; json: string }) => void;
  dynamicFields?: DynamicField[];
}

export function EmailEditor({ initialBlocks, onChange, dynamicFields }: EmailEditorProps) {
  const [blocks, setBlocks] = useState<EmailBlock[]>(initialBlocks || []);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // Sync initial blocks
  useEffect(() => {
    if (initialBlocks && initialBlocks.length > 0) {
      setBlocks(initialBlocks);
    }
  }, [initialBlocks]);

  // Emit changes
  const emitChange = useCallback(
    (newBlocks: EmailBlock[]) => {
      if (onChange) {
        onChange({
          html: blocksToHtml(newBlocks),
          json: JSON.stringify(newBlocks),
        });
      }
    },
    [onChange]
  );

  const updateBlocks = useCallback(
    (newBlocks: EmailBlock[]) => {
      setBlocks(newBlocks);
      emitChange(newBlocks);
    },
    [emitChange]
  );

  const addBlock = (type: EmailBlock["type"]) => {
    const newBlock = createBlock(type);
    const newBlocks = [...blocks, newBlock];
    updateBlocks(newBlocks);
    setSelectedBlockId(newBlock.id);
  };

  const deleteBlock = (id: string) => {
    const newBlocks = blocks.filter((b) => b.id !== id);
    updateBlocks(newBlocks);
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const updateBlockProps = (
    id: string,
    props: Record<string, string | number | EmailBlock[][]>
  ) => {
    const newBlocks = blocks.map((b) =>
      b.id === id ? { ...b, props } : b
    );
    updateBlocks(newBlocks);
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const newIdx = direction === "up" ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[idx]];
    updateBlocks(newBlocks);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newBlocks = [...blocks];
    const [removed] = newBlocks.splice(result.source.index, 1);
    newBlocks.splice(result.destination.index, 0, removed);
    updateBlocks(newBlocks);
  };

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg border">
          {BLOCK_TYPES.map((bt) => {
            const Icon = bt.icon;
            return (
              <Button
                key={bt.type}
                variant="outline"
                size="sm"
                onClick={() => addBlock(bt.type)}
                className="gap-1.5"
              >
                <Icon className="h-3.5 w-3.5" />
                {bt.label}
              </Button>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="border rounded-lg bg-[#f4f4f5] dark:bg-muted/20 p-4 min-h-[400px]">
          <div className="max-w-[600px] mx-auto bg-white dark:bg-card rounded shadow-sm">
            {blocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Type className="h-8 w-8 mb-2" />
                <p className="text-sm">
                  Click a block type above to start building your email
                </p>
              </div>
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="email-blocks">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                    >
                      {blocks.map((block, index) => (
                        <Draggable
                          key={block.id}
                          draggableId={block.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "group relative",
                                snapshot.isDragging && "opacity-50"
                              )}
                            >
                              {/* Block controls */}
                              <div className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-0.5">
                                <div
                                  {...provided.dragHandleProps}
                                  className="p-0.5 bg-background border rounded cursor-grab"
                                >
                                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <button
                                  onClick={() => moveBlock(block.id, "up")}
                                  className="p-0.5 bg-background border rounded hover:bg-accent"
                                  disabled={index === 0}
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => moveBlock(block.id, "down")}
                                  className="p-0.5 bg-background border rounded hover:bg-accent"
                                  disabled={index === blocks.length - 1}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>

                              <BlockPreview
                                block={block}
                                isSelected={selectedBlockId === block.id}
                                onClick={() => setSelectedBlockId(block.id)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        </div>
      </div>

      {/* Properties Panel */}
      <div className="border rounded-lg p-4 bg-card h-fit lg:sticky lg:top-4">
        <h3 className="text-sm font-semibold mb-3">Properties</h3>
        <Separator className="mb-3" />
        {selectedBlock ? (
          <ScrollArea className="max-h-[600px]">
            <PropertiesPanel
              block={selectedBlock}
              onChange={(props) => updateBlockProps(selectedBlock.id, props)}
              onDelete={() => deleteBlock(selectedBlock.id)}
              dynamicFields={dynamicFields}
            />
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Select a block to edit its properties
          </p>
        )}
      </div>
    </div>
  );
}
