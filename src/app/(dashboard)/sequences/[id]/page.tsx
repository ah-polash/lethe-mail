"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Save,
  Mail,
  Webhook,
  Eye,
  Code,
  Zap,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { flattenKeys, resolveMergeTags, getByPath, type FlatKey } from "@/lib/merge";
import { toast } from "sonner";

interface Step {
  id: string;
  stepNumber: number;
  name: string | null;
  eventType: string | null;
  subject: string;
  htmlContent: string;
  aiPrompt: string | null;
}

interface Sequence {
  id: number;
  name: string;
  description: string | null;
  fromEmail: string;
  fromName: string;
  status: "active" | "paused";
  sequenceType:
    | "freemius_event"
    | "lead_nurture"
    | "upsell"
    | "cross_sell"
    | "discount"
    | "free_to_paid"
    | "win_back"
    | "renewal"
    | "review_request"
    | "gift_from_ceo";
  emailField: string;
  eventField: string;
  webhookToken: string;
  steps: Step[];
}

const AI_STYLES = ["professional", "modern", "playful", "minimal", "bold"];

type EventPreset = { name: string; eventType: string; subject: string };

// The 10 Freemius lifecycle moments where emailing a user makes sense —
// onboarding → activation → trial → purchase → renewal → dunning → churn → refund.
const POPULAR_EVENTS: EventPreset[] = [
  { name: "Welcome", eventType: "install.installed", subject: "Welcome aboard, {{objects.user.first}}! 👋" },
  { name: "Getting Started", eventType: "install.activated", subject: "Let's get you started, {{objects.user.first}}" },
  { name: "Trial Started", eventType: "install.trial.started", subject: "Your free trial has begun 🚀" },
  { name: "Trial Ending", eventType: "install.trial.expired", subject: "Your trial ended — keep your premium features" },
  { name: "Purchase Thank You", eventType: "license.activated", subject: "Thank you for upgrading, {{objects.user.first}} 🙏" },
  { name: "License Expired", eventType: "license.expired", subject: "Your license expired — renew to stay protected" },
  { name: "Payment Failed", eventType: "subscription.renewal.failed", subject: "Action needed: your payment didn't go through" },
  { name: "Subscription Cancelled", eventType: "subscription.cancelled", subject: "Sorry to see you go — one quick question" },
  { name: "Uninstalled", eventType: "install.uninstalled", subject: "We're sorry to see you go 😔" },
  { name: "Refund", eventType: "payment.refund", subject: "Your refund has been processed" },
];

// 5 more meaningful touchpoints, appended for the "Add 15 Events" action.
const EXTRA_EVENTS: EventPreset[] = [
  { name: "Premium Activated", eventType: "install.premium.activated", subject: "Your premium features are live 🔓" },
  { name: "Subscription Started", eventType: "subscription.created", subject: "You're all set — here's what's included" },
  { name: "Trial Expiring Soon", eventType: "install.trial_expiring_notice.sent", subject: "Your trial ends soon — don't lose your setup" },
  { name: "Renewal Reminder", eventType: "license.renewal_reminder.sent", subject: "Your license renews soon, {{objects.user.first}}" },
  { name: "Deactivated", eventType: "install.deactivated", subject: "Did something go wrong? We'd love to help" },
];

const POPULAR_EVENTS_15: EventPreset[] = [...POPULAR_EVENTS, ...EXTRA_EVENTS];

// Classic lead-nurture / brand-familiarity drip, ordered by importance so the
// first 5 are the essentials, the first 10 add depth, and 15 completes the arc.
const NURTURE_STEPS: { name: string; subject: string }[] = [
  { name: "Welcome", subject: "Welcome aboard! Here's what to expect 👋" },
  { name: "Our Story", subject: "The story behind who we are" },
  { name: "The Problem We Solve", subject: "The #1 challenge we help you beat" },
  { name: "Social Proof", subject: "See what others are achieving" },
  { name: "Quick Win Tip", subject: "A quick tip you can use today" },
  { name: "Feature Spotlight", subject: "The one feature our users love most" },
  { name: "Customer Success Story", subject: "A real success story worth reading" },
  { name: "Overcome Objections", subject: "Wondering if it's right for you?" },
  { name: "Free Resource", subject: "A free resource, just for you" },
  { name: "Behind the Scenes", subject: "A peek behind the scenes" },
  { name: "Tips & Best Practices", subject: "5 best practices to get more value" },
  { name: "Why Choose Us", subject: "Why teams choose us over the alternatives" },
  { name: "Exclusive Offer", subject: "An exclusive offer, just for you" },
  { name: "Limited-Time Reminder", subject: "Last chance — don't miss out" },
  { name: "Let's Stay Connected", subject: "Let's keep in touch 💌" },
];

// Upsell / upgrade drip, ordered by importance — first 5 essentials, first 10
// add depth, 15 completes the arc.
const UPSELL_STEPS: { name: string; subject: string }[] = [
  { name: "Ready to Level Up", subject: "Ready to unlock more?" },
  { name: "Premium Feature Teaser", subject: "The premium features you're missing out on" },
  { name: "Upgrade Benefits", subject: "3 reasons to upgrade today" },
  { name: "Free vs Pro", subject: "Free vs Pro: see exactly what you get" },
  { name: "Limited-Time Discount", subject: "Save on your upgrade — this week only" },
  { name: "Success Milestone", subject: "Look how far you've come 🎉" },
  { name: "Pro Social Proof", subject: "Why power users choose Pro" },
  { name: "Case Study", subject: "How upgrading paid off for a customer like you" },
  { name: "Overcome Objections", subject: "Is upgrading worth it? The honest answer" },
  { name: "Bundle & Add-ons", subject: "Get even more with our bundle" },
  { name: "Exclusive Pro Perk", subject: "A perk reserved for Pro users" },
  { name: "The Upgrade That Pays for Itself", subject: "The upgrade that pays for itself" },
  { name: "Loyalty Offer", subject: "A thank-you offer for loyal users" },
  { name: "Last Chance", subject: "Last chance to upgrade at this price" },
  { name: "Final Nudge", subject: "Still thinking it over?" },
];

// Cross-sell drip — recommend complementary products / add-ons. Ordered by
// importance: first 5 essentials, first 10 add depth, 15 completes the arc.
const CROSS_SELL_STEPS: { name: string; subject: string }[] = [
  { name: "Complete Your Toolkit", subject: "Complete your toolkit" },
  { name: "Customers Also Use", subject: "Customers who love this also use…" },
  { name: "Perfect Pairing", subject: "The perfect companion to what you have" },
  { name: "Bundle & Save", subject: "Save when you bundle" },
  { name: "You Might Also Love", subject: "You might also love this" },
  { name: "Solve the Next Problem", subject: "Solved that? Here's what's next" },
  { name: "Social Proof", subject: "What others added to their stack" },
  { name: "Use-Case Story", subject: "How teams combine our products" },
  { name: "Add-on Benefits", subject: "3 reasons to add this to your kit" },
  { name: "Special Add-on Offer", subject: "A special price on the perfect add-on" },
  { name: "Which Add-on Fits", subject: "Which add-on is right for you?" },
  { name: "Exclusive Bundle Deal", subject: "An exclusive bundle, just for you" },
  { name: "Hand-Picked for You", subject: "Hand-picked recommendations for you" },
  { name: "Last Chance", subject: "Last chance for this bundle price" },
  { name: "One More Thing", subject: "One more thing you might like" },
];

// Promotional discount drip — ordered by importance: first 5 essentials, first
// 10 add depth, 15 completes the arc (urgency ramp).
const DISCOUNT_STEPS: { name: string; subject: string }[] = [
  { name: "Special Offer Inside", subject: "A special offer, just for you 🎁" },
  { name: "Your Discount Code", subject: "Here's your discount code" },
  { name: "Limited-Time Deal", subject: "Limited time: save big today" },
  { name: "Discount Reminder", subject: "Don't forget your discount" },
  { name: "Ending Soon", subject: "Your discount ends soon ⏰" },
  { name: "Last Day", subject: "Last day to save" },
  { name: "Final Hours", subject: "Final hours — offer ends tonight" },
  { name: "Offer Extended", subject: "Good news: your discount is extended" },
  { name: "Even Bigger Savings", subject: "An even better deal for you" },
  { name: "Bestsellers on Sale", subject: "Our bestsellers, now discounted" },
  { name: "Social Proof", subject: "Thousands already grabbed this deal" },
  { name: "Why Buy Now", subject: "Why now is the time to buy" },
  { name: "Bundle & Save More", subject: "Save even more when you bundle" },
  { name: "Last Chance", subject: "Last chance — don't miss out" },
  { name: "One More Chance", subject: "Missed it? Here's one more chance" },
];

// Free → Paid conversion drip: educate on value, expose what Pro unlocks, build
// proof, handle objections, add urgency + incentive. Ordered by importance —
// first 5 essentials, first 10 add depth, 15 completes the upgrade path.
const FREE_TO_PAID_STEPS: { name: string; subject: string }[] = [
  { name: "Welcome & Quick Win", subject: "Welcome! Let's get your first win" },
  { name: "Discover Core Value", subject: "Get the most out of your free plan" },
  { name: "What You're Missing", subject: "You're missing out on these Pro features" },
  { name: "Pro Feature Deep-Dive", subject: "See exactly what Pro can do for you" },
  { name: "Social Proof", subject: "Why thousands upgraded to Pro" },
  { name: "You've Hit the Free Limit", subject: "You've reached your free plan limit" },
  { name: "ROI / Case Study", subject: "How Pro paid off for users like you" },
  { name: "Free vs Pro", subject: "Free vs Pro: the full breakdown" },
  { name: "Overcome Objections", subject: "Not sure Pro is worth it? Let's talk" },
  { name: "Limited-Time Upgrade Offer", subject: "Upgrade now and save" },
  { name: "Exclusive Pro Perk", subject: "A perk you only unlock with Pro" },
  { name: "Personal Recommendation", subject: "The Pro plan we'd pick for you" },
  { name: "Deadline Reminder", subject: "Your upgrade discount ends soon" },
  { name: "Last Chance", subject: "Last chance to upgrade at this price" },
  { name: "Final Nudge", subject: "Still on the free plan? Tell us why" },
];

// Win-back / re-engagement drip for churned or dormant users. Ordered by
// importance — first 5 essentials, first 10 add depth, 15 completes the arc.
const WIN_BACK_STEPS: { name: string; subject: string }[] = [
  { name: "We Miss You", subject: "We miss you 👋" },
  { name: "What's New Since You Left", subject: "Here's what's new since you left" },
  { name: "Did We Do Something Wrong", subject: "Did we do something wrong?" },
  { name: "Look What You're Missing", subject: "Look what you're missing" },
  { name: "A Reason to Come Back", subject: "A reason to come back" },
  { name: "Success Stories", subject: "See what others are achieving now" },
  { name: "Special Comeback Offer", subject: "A special offer to welcome you back" },
  { name: "We've Made Improvements", subject: "We've fixed what you didn't like" },
  { name: "Personal Check-in", subject: "Can we help you get started again?" },
  { name: "Limited-Time Incentive", subject: "Your comeback discount ends soon" },
  { name: "Feedback Request", subject: "Tell us why you left" },
  { name: "Join the Community", subject: "Join the community that stuck around" },
  { name: "Last Chance to Reactivate", subject: "Last chance to reactivate" },
  { name: "Should We Say Goodbye", subject: "Should we say goodbye?" },
  { name: "One Last Thing", subject: "One last thing before you go" },
];

// Renewal / retention drip to prevent subscription & license churn before and
// around expiry. Ordered by importance — first 5 essentials, then depth to 15.
const RENEWAL_STEPS: { name: string; subject: string }[] = [
  { name: "Renewal Coming Up", subject: "Your renewal is coming up" },
  { name: "Your Year in Review", subject: "Everything you've gotten this year" },
  { name: "Why It Pays to Stay", subject: "Why it pays to stay with us" },
  { name: "What's New & Next", subject: "New features you'll keep getting" },
  { name: "Renew & Save", subject: "Renew now and save" },
  { name: "Auto-Renew Reminder", subject: "Your plan renews soon" },
  { name: "Update Your Billing", subject: "Action needed: update your billing" },
  { name: "Payment Retry", subject: "Let's get your renewal sorted" },
  { name: "Loyalty Reward", subject: "A loyalty reward for renewing" },
  { name: "Expiry Warning", subject: "Your license expires in 7 days" },
  { name: "Grace Period", subject: "Your access ends soon — renew to keep it" },
  { name: "What You'll Lose", subject: "Don't lose your premium features" },
  { name: "Last Chance to Renew", subject: "Last chance to renew at this price" },
  { name: "Expired — Reactivate", subject: "Your license has expired — reactivate now" },
  { name: "Win-back After Expiry", subject: "Come back — here's an offer" },
];

// Review & testimonial request drip to turn happy users into wp.org reviews,
// testimonials and referrals. Ordered by importance — first 5 essentials to 15.
const REVIEW_REQUEST_STEPS: { name: string; subject: string }[] = [
  { name: "Enjoying the Plugin", subject: "Enjoying the plugin? 🌟" },
  { name: "A Quick Favor", subject: "A quick favor to ask" },
  { name: "Leave a Review", subject: "Would you leave a quick review?" },
  { name: "Rate Us", subject: "Rate your experience in 30 seconds" },
  { name: "Share Your Story", subject: "Share your success story" },
  { name: "Testimonial Request", subject: "Can we feature your feedback?" },
  { name: "Spread the Word", subject: "Loved it? Help spread the word" },
  { name: "Case Study Invite", subject: "Want to be featured in a case study?" },
  { name: "Quick Feedback Survey", subject: "Help us improve — a quick survey" },
  { name: "Thank You", subject: "Thank you for your support 🙏" },
  { name: "Reviewer Perk", subject: "A thank-you gift for your review" },
  { name: "Gentle Reminder", subject: "Still love it? A quick review helps a lot" },
  { name: "Referral Ask", subject: "Know someone who'd love this?" },
  { name: "Community Spotlight", subject: "Join our community of fans" },
  { name: "Final Thank You", subject: "You're the reason we do this" },
];

// "Gift From CEO" — a personal relationship drip: get to know the CEO, connect
// on LinkedIn & social, and receive a special CEO discount code. Ordered so the
// first 5 already cover intro + social connect + gift; depth continues to 15.
const GIFT_FROM_CEO_STEPS: { name: string; subject: string }[] = [
  { name: "A Personal Hello from the CEO", subject: "A personal note from our CEO 👋" },
  { name: "Meet the CEO", subject: "The person behind the product" },
  { name: "Connect on LinkedIn", subject: "Let's connect on LinkedIn" },
  { name: "Follow Us on Social", subject: "Follow along on social media" },
  { name: "Your Special CEO Discount", subject: "A gift from our CEO: your exclusive code 🎁" },
  { name: "Our Mission & Story", subject: "Why I started this company" },
  { name: "Behind the Scenes", subject: "A peek behind the scenes with me" },
  { name: "My Favorite Tips", subject: "My personal tips to get the most out of it" },
  { name: "A Customer Who Inspired Me", subject: "A story that inspired our whole team" },
  { name: "What We're Building Next", subject: "Here's what we're building next" },
  { name: "I'd Love Your Feedback", subject: "I read every reply — tell me what you think" },
  { name: "Reminder: Your Gift Awaits", subject: "Don't forget your gift 🎁" },
  { name: "Join Our Community", subject: "Join our community" },
  { name: "Let's Stay Connected", subject: "Let's keep in touch" },
  { name: "Thank You From the CEO", subject: "Thank you — from me personally 🙏" },
];

interface SesIdentity {
  identity: string;
  type: string;
  verified: boolean;
}

interface ProductInfo {
  id: string;
  name: string;
  logoUrl: string | null;
  wpOrgSlug: string | null;
  landingPageUrl: string | null;
  pricingPageUrl: string | null;
}

// What each event's email should accomplish — used to steer the AI per step.
const EVENT_PURPOSE: Record<string, string> = {
  "install.installed": "Warmly welcome a brand-new user who just installed the plugin. Orient them on the very first steps and where to get help.",
  "install.activated": "Help a user who just activated the plugin get their first quick win; link to setup docs.",
  "install.trial.started": "Congratulate the user on starting a free trial; highlight the premium features to try and how to get value fast.",
  "install.trial.expired": "The trial has ended; encourage upgrading to keep premium features, with a clear pricing CTA.",
  "install.trial_expiring_notice.sent": "The trial ends soon; nudge the user to upgrade before losing their setup, with a pricing CTA.",
  "license.activated": "Thank the user for purchasing/upgrading; confirm their premium access and point to advanced features.",
  "license.expired": "The license has expired; urge renewal to restore updates and support, with a renew CTA.",
  "license.renewal_reminder.sent": "The license renews/expires soon; remind them to renew to keep updates and support.",
  "subscription.created": "Confirm a new subscription; summarize what's included and how to manage billing.",
  "subscription.renewal.failed": "A renewal payment failed; ask the user to update their billing details to avoid losing access.",
  "subscription.cancelled": "The subscription was cancelled; a friendly win-back asking for feedback and offering to help.",
  "install.premium.activated": "The premium version is now active; onboard the user to premium-only features.",
  "install.deactivated": "The user deactivated the plugin; check in, offer help, and ask if something went wrong.",
  "install.uninstalled": "The user uninstalled the plugin; a gracious goodbye asking for quick feedback on why they left.",
  "payment.refund": "Confirm a refund was processed; keep it courteous and offer future help.",
};

function buildProductPrompt(product: ProductInfo, step: { name: string | null; eventType: string | null; subject: string }): string {
  const purpose =
    (step.eventType && EVENT_PURPOSE[step.eventType]) ||
    (step.eventType
      ? `An email for the "${step.name || "Untitled"}" step (triggered by the "${step.eventType}" event).`
      : `A lead-nurturing, brand-familiarity email (step "${step.name || "Untitled"}") that builds trust and gently showcases the product's value with a soft call-to-action.`);
  return [
    `Write a polished, responsive HTML email for the WordPress plugin "${product.name}".`,
    `Email purpose: ${purpose}`,
    product.landingPageUrl ? `Primary CTA / product page: ${product.landingPageUrl}` : "",
    product.pricingPageUrl ? `Pricing / upgrade / renew page: ${product.pricingPageUrl}` : "",
    product.wpOrgSlug ? `WordPress.org slug: ${product.wpOrgSlug}` : "",
    product.logoUrl ? `Include this brand logo in the header: ${product.logoUrl}` : "",
    `Greet the recipient using the merge tag {{objects.user.first}} for their first name (it may be empty — handle gracefully).`,
    `Keep it concise, friendly and on-brand, with one clear call-to-action button. Return complete HTML.`,
  ]
    .filter(Boolean)
    .join("\n");
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Copied");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Copy failed");
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}

// Inline event-type field for a rail item. Local state so typing never loses
// focus on parent re-renders; commits on blur or Enter.
function StepEventField({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => {
    setV(value);
  }, [value]);
  return (
    <input
      value={v}
      spellCheck={false}
      placeholder="event.type — e.g. license.activated"
      onChange={(e) => setV(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      onBlur={() => {
        if (v.trim() !== value.trim()) onSave(v);
      }}
      className="min-w-0 flex-1 rounded border border-dashed bg-background/60 px-1.5 py-0.5 font-mono text-[11px] outline-none focus:border-primary focus:border-solid"
    />
  );
}

// Detect a "/" placeholder trigger at the caret. A trigger is a "/" that is at
// the start of the string or preceded by whitespace; the text after it (up to
// the caret, with no whitespace) is the filter query.
function detectSlashTrigger(value: string, caret: number): { start: number; query: string } | null {
  let i = caret - 1;
  while (i >= 0) {
    const ch = value[i];
    if (ch === "/") {
      const before = i === 0 ? " " : value[i - 1];
      if (i === 0 || /\s/.test(before)) return { start: i, query: value.slice(i + 1, caret) };
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

// Text input with a "/"-triggered dropdown of available placeholder keys.
// Selecting a key inserts {{path}} at the caret.
function PlaceholderInput({
  value,
  onChange,
  onCommit,
  keys,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: (v: string) => void;
  keys: FlatKey[];
  placeholder?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [trigger, setTrigger] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [caretAfter, setCaretAfter] = useState<number | null>(null);

  const matches = useMemo(() => {
    if (!trigger) return [];
    const q = trigger.query.toLowerCase();
    return keys.filter((k) => k.path.toLowerCase().includes(q)).slice(0, 50);
  }, [trigger, keys]);

  // Restore caret position after a programmatic value change (insert).
  useEffect(() => {
    if (caretAfter !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.setSelectionRange(caretAfter, caretAfter);
      setCaretAfter(null);
    }
  }, [caretAfter, value]);

  function refresh(el: HTMLInputElement) {
    const t = detectSlashTrigger(el.value, el.selectionStart ?? el.value.length);
    setTrigger(t);
    setActive(0);
  }

  function insert(path: string) {
    if (!trigger) return;
    const el = inputRef.current;
    const caret = el?.selectionStart ?? value.length;
    const tag = `{{${path}}}`;
    const next = value.slice(0, trigger.start) + tag + value.slice(caret);
    onChange(next);
    setTrigger(null);
    setCaretAfter(trigger.start + tag.length);
  }

  const open = trigger !== null && matches.length > 0;

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          refresh(e.target);
        }}
        onClick={(e) => refresh(e.currentTarget)}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) refresh(e.currentTarget);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % matches.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + matches.length) % matches.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            insert(matches[active].path);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setTrigger(null);
          }
        }}
        onBlur={(e) => {
          const v = e.currentTarget.value;
          setTimeout(() => setTrigger(null), 120);
          onCommit?.(v);
        }}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
          <div className="px-2 py-1.5 text-[11px] text-muted-foreground border-b">
            Insert placeholder{trigger?.query ? ` — “${trigger.query}”` : ""}
          </div>
          {matches.map((m, i) => (
            <button
              key={m.path}
              type="button"
              // onMouseDown (not onClick) so it fires before the input's onBlur closes the menu.
              onMouseDown={(e) => {
                e.preventDefault();
                insert(m.path);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left text-xs",
                i === active ? "bg-accent" : "hover:bg-accent/60"
              )}
            >
              <span className="font-mono truncate">{`{{${m.path}}}`}</span>
              {m.value && (
                <span className="text-muted-foreground truncate max-w-[45%]">{m.value}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SequenceEditorPage() {
  const params = useParams<{ id: string }>();
  const seqId = Number(params.id);

  const [seq, setSeq] = useState<Sequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [addingEvents, setAddingEvents] = useState(false);

  // Verified SES sender identities for the From email dropdown
  const [identities, setIdentities] = useState<SesIdentity[]>([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(true);

  // Product-driven bulk AI generation
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [generatingAll, setGeneratingAll] = useState(false);
  const [genProgress, setGenProgress] = useState("");

  // step editor local state
  const [draft, setDraft] = useState<Step | null>(null);
  const [savingStep, setSavingStep] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("professional");
  const [generating, setGenerating] = useState(false);

  // Test payload used to preview merge-tag substitution in the subject/body.
  const [testPayload, setTestPayload] = useState(
    '{\n  "email": "user@example.com",\n  "firstName": "Jane"\n}'
  );

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sequences/${seqId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setSeq(data.sequence);
      if (data.sequence.steps.length > 0 && selectedStep === null) {
        setSelectedStep(data.sequence.steps[0].stepNumber);
      }
    } catch {
      toast.error("Could not load sequence");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seqId]);

  useEffect(() => {
    load();
  }, [load]);

  // Load verified SES identities for the From email dropdown.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/ses/identities");
        const data = await res.json();
        const emailOnly: SesIdentity[] = (data.identities || []).filter(
          (i: SesIdentity) => i.verified && i.type === "EMAIL_ADDRESS"
        );
        setIdentities(emailOnly);
      } catch {
        /* ignore — falls back to empty */
      } finally {
        setIdentitiesLoading(false);
      }
    })();
  }, []);

  // Load products (from Settings → Product Settings) for AI generation context.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) return;
        const data = await res.json();
        const list: ProductInfo[] = data.products || [];
        setProducts(list);
        if (list.length > 0) setSelectedProductId((prev) => prev || list[0].id);
      } catch {
        /* ignore — dropdown just stays empty */
      }
    })();
  }, []);

  // sync draft when selected step changes
  useEffect(() => {
    if (!seq || selectedStep === null) {
      setDraft(null);
      return;
    }
    const step = seq.steps.find((s) => s.stepNumber === selectedStep) || null;
    setDraft(step ? { ...step } : null);
    setAiPrompt(step?.aiPrompt || "");
  }, [selectedStep, seq]);

  async function saveMeta(patch: Partial<Sequence>) {
    if (!seq) return;
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/sequences/${seqId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed");
      setSeq({ ...seq, ...patch });
    } catch {
      toast.error("Could not save");
    } finally {
      setSavingMeta(false);
    }
  }

  async function addStep() {
    try {
      const res = await fetch(`/api/sequences/${seqId}/steps`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
      setSelectedStep(data.step.stepNumber);
      toast.success(`Step ${data.step.stepNumber} added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add step");
    }
  }

  // Add a preset list of lifecycle events as steps, skipping any event type that
  // already exists on this sequence (so re-clicking won't create duplicates).
  async function addEvents(events: EventPreset[]) {
    if (!seq) return;
    const existing = new Set(seq.steps.map((s) => (s.eventType || "").trim()).filter(Boolean));
    const toAdd = events.filter((e) => !existing.has(e.eventType));
    if (toAdd.length === 0) {
      toast.info("All those events are already added");
      return;
    }
    setAddingEvents(true);
    try {
      const res = await fetch(`/api/sequences/${seqId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: toAdd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
      const firstNew = data.steps?.[0]?.stepNumber;
      if (firstNew) setSelectedStep(firstNew);
      toast.success(
        `Added ${toAdd.length} event step${toAdd.length === 1 ? "" : "s"}` +
          (toAdd.length < events.length ? ` (${events.length - toAdd.length} already existed)` : "")
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add events");
    } finally {
      setAddingEvents(false);
    }
  }

  // Persist just a step's event type (used by the inline rail field).
  async function saveStepEvent(stepNumber: number, eventType: string) {
    try {
      const res = await fetch(`/api/sequences/${seqId}/steps/${stepNumber}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventType }),
      });
      if (!res.ok) throw new Error("Failed");
      setSeq((prev) =>
        prev
          ? {
              ...prev,
              steps: prev.steps.map((s) =>
                s.stepNumber === stepNumber ? { ...s, eventType: eventType.trim() || null } : s
              ),
            }
          : prev
      );
      if (draft?.stepNumber === stepNumber) {
        setDraft((d) => (d ? { ...d, eventType: eventType.trim() || null } : d));
      }
    } catch {
      toast.error("Could not save event type");
    }
  }

  // Append the first `count` titled steps from a preset list (no event type).
  async function addTitledSteps(list: { name: string; subject: string }[], count: number) {
    if (!seq) return;
    const toAdd = list.slice(0, count).map((s) => ({ name: s.name, subject: s.subject }));
    setAddingEvents(true);
    try {
      const res = await fetch(`/api/sequences/${seqId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: toAdd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
      const firstNew = data.steps?.[0]?.stepNumber;
      if (firstNew) setSelectedStep(firstNew);
      toast.success(`Added ${toAdd.length} steps`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add steps");
    } finally {
      setAddingEvents(false);
    }
  }

  // Generate an AI email for EVERY step using the selected product's data.
  // Runs sequentially (per step) so we get progress and stay resilient to
  // individual failures / serverless timeouts.
  async function generateAllSteps() {
    if (!seq) return;
    const product = products.find((p) => p.id === selectedProductId);
    if (!product) {
      toast.error("Select a product first");
      return;
    }
    if (seq.steps.length === 0) {
      toast.error("Add steps before generating");
      return;
    }

    setGeneratingAll(true);
    const steps = [...seq.steps].sort((a, b) => a.stepNumber - b.stepNumber);
    let ok = 0;
    let fail = 0;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setGenProgress(`${i + 1}/${steps.length}`);
      try {
        const genRes = await fetch("/api/templates/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: buildProductPrompt(product, step),
            style: "professional",
            aiMode: "true",
            templateName: `${product.name} - ${step.name || `Email ${step.stepNumber}`}`,
            templateSubject: step.subject,
          }),
        });
        const gen = await genRes.json();
        if (!genRes.ok || !gen.html) throw new Error(gen.error || "generation failed");

        const saveRes = await fetch(`/api/sequences/${seqId}/steps/${step.stepNumber}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            htmlContent: gen.html,
            subject: gen.subject || step.subject,
            aiPrompt: buildProductPrompt(product, step),
          }),
        });
        if (!saveRes.ok) throw new Error("save failed");

        // Also archive the generated email into the Sequence Templates library.
        fetch("/api/sequence-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${product.name} - ${step.name || `Email ${step.stepNumber}`}`,
            subject: gen.subject || step.subject,
            htmlContent: gen.html,
            sequenceId: seq.id,
            sequenceName: seq.name,
            stepNumber: step.stepNumber,
            productName: product.name,
          }),
        }).catch(() => {});

        ok++;
      } catch {
        fail++;
      }
    }

    setGeneratingAll(false);
    setGenProgress("");
    await load();
    if (ok > 0) {
      toast.success(`Generated ${ok} email${ok === 1 ? "" : "s"}${fail ? `, ${fail} failed` : ""}`);
    } else {
      toast.error("Generation failed for all steps — check AI configuration in Settings");
    }
  }

  async function removeAllSteps() {
    if (!seq || seq.steps.length === 0) return;
    setAddingEvents(true);
    try {
      const res = await fetch(`/api/sequences/${seqId}/steps`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      setSelectedStep(null);
      setDraft(null);
      await load();
      toast.success(`Removed ${data.deleted ?? "all"} step${data.deleted === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove steps");
    } finally {
      setAddingEvents(false);
    }
  }

  async function deleteStep(stepNumber: number) {
    try {
      const res = await fetch(`/api/sequences/${seqId}/steps/${stepNumber}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Step deleted");
      setSelectedStep(null);
      await load();
    } catch {
      toast.error("Could not delete step");
    }
  }

  async function saveStep() {
    if (!draft) return;
    setSavingStep(true);
    try {
      const res = await fetch(`/api/sequences/${seqId}/steps/${draft.stepNumber}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name || "",
          subject: draft.subject,
          htmlContent: draft.htmlContent,
          aiPrompt,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(`Step ${draft.stepNumber} saved`);
      await load();
    } catch {
      toast.error("Could not save step");
    } finally {
      setSavingStep(false);
    }
  }

  async function generateAi() {
    if (!aiPrompt.trim()) {
      toast.error("Describe the email you want");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/templates/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, style: aiStyle, aiMode: "true" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setDraft((d) =>
        d ? { ...d, htmlContent: data.html || d.htmlContent, subject: data.subject || d.subject } : d
      );
      if (data.aiError) {
        toast.warning("AI provider failed — inserted a fallback template. Check AI settings.");
      } else {
        toast.success("Email generated");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const webhookBase = seq ? `${origin}/send/${seq.id}` : "";
  const stepWebhook = useMemo(() => {
    if (!seq || !draft) return "";
    return `${webhookBase}/${draft.stepNumber}?token=${seq.webhookToken}`;
  }, [seq, draft, webhookBase]);

  // Parse the test payload; expose keys + a merge-tag resolver for the preview.
  const parsedPayload = useMemo<{ data: Record<string, unknown> | null; error: string | null }>(() => {
    if (!testPayload.trim()) return { data: {}, error: null };
    try {
      const obj = JSON.parse(testPayload);
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
        return { data: null, error: "Payload must be a JSON object" };
      }
      return { data: obj as Record<string, unknown>, error: null };
    } catch {
      return { data: null, error: "Invalid JSON" };
    }
  }, [testPayload]);

  const resolveTags = useCallback(
    (template: string): string => resolveMergeTags(template, parsedPayload.data || {}),
    [parsedPayload]
  );

  // All available keys, flattened to dot-paths (handles the deeply nested webhook shape).
  const payloadKeys = useMemo(
    () => (parsedPayload.data ? flattenKeys(parsedPayload.data) : []),
    [parsedPayload]
  );

  // The recipient email as resolved from the configured emailField path.
  const resolvedEmail = useMemo(() => {
    if (!seq || !parsedPayload.data) return "";
    const v = getByPath(parsedPayload.data, seq.emailField || "email");
    return typeof v === "string" ? v : v == null ? "" : String(v);
  }, [seq, parsedPayload]);

  // Sequence-level event webhook: one URL that auto-selects the step by event type.
  const eventWebhook = seq ? `${webhookBase}?token=${seq.webhookToken}` : "";

  // cURL uses the actual test payload (compacted) when it is valid JSON.
  const curlExample = useMemo(() => {
    if (!stepWebhook) return "";
    const bodyObj = parsedPayload.data && !parsedPayload.error ? parsedPayload.data : { email: "user@example.com", firstName: "Jane" };
    const compact = JSON.stringify(bodyObj);
    return `curl -X POST "${stepWebhook}" \\
  -H "Content-Type: application/json" \\
  -d '${compact.replace(/'/g, "'\\''")}'`;
  }, [stepWebhook, parsedPayload]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  if (!seq) {
    return (
      <div className="mx-auto max-w-2xl text-center py-24">
        <p className="text-muted-foreground">Sequence not found.</p>
        <Link href="/sequences" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
          Back to sequences
        </Link>
      </div>
    );
  }

  // Freemius Event Sequence = auto-dispatch by event type. Lead Nurture & Upsell
  // fire steps explicitly by /send/{id}/{stepNumber}. `isFreemius` toggles the
  // event-specific UI (inline event types, Add N Events, event webhook).
  const seqType = seq.sequenceType || "freemius_event";
  const isFreemius = seqType === "freemius_event";
  const TITLED_PRESETS: Record<string, { list: { name: string; subject: string }[]; label: string }> = {
    lead_nurture: { list: NURTURE_STEPS, label: "lead-nurture" },
    upsell: { list: UPSELL_STEPS, label: "upsell" },
    cross_sell: { list: CROSS_SELL_STEPS, label: "cross-sell" },
    discount: { list: DISCOUNT_STEPS, label: "discount" },
    free_to_paid: { list: FREE_TO_PAID_STEPS, label: "free-to-paid" },
    win_back: { list: WIN_BACK_STEPS, label: "win-back" },
    renewal: { list: RENEWAL_STEPS, label: "renewal" },
    review_request: { list: REVIEW_REQUEST_STEPS, label: "review-request" },
    gift_from_ceo: { list: GIFT_FROM_CEO_STEPS, label: "gift-from-CEO" },
  };
  const titledPreset = TITLED_PRESETS[seqType]?.list ?? NURTURE_STEPS;
  const titledLabel = TITLED_PRESETS[seqType]?.label ?? "lead-nurture";

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/sequences" className={cn(buttonVariants({ variant: "outline", size: "icon" }))}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Input
                className="text-lg font-semibold h-9 w-auto min-w-[16rem]"
                value={seq.name}
                onChange={(e) => setSeq({ ...seq, name: e.target.value })}
                onBlur={() => saveMeta({ name: seq.name })}
              />
              <Badge variant="secondary">#{seq.id}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {savingMeta && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <div className="flex items-center gap-2">
            <Switch
              checked={seq.status === "active"}
              onCheckedChange={(v) => saveMeta({ status: v ? "active" : "paused" })}
            />
            <span className="text-sm text-muted-foreground w-14">
              {seq.status === "active" ? "Active" : "Paused"}
            </span>
          </div>
        </div>
      </div>

      {/* Sender settings */}
      <Card className="mb-6">
        <CardContent className="grid gap-4 sm:grid-cols-2 pt-6">
          <div className="space-y-2">
            <Label>From email (SES-verified sender)</Label>
            {identitiesLoading ? (
              <div className="flex items-center text-sm text-muted-foreground h-8">
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Loading identities…
              </div>
            ) : identities.length === 0 ? (
              <p className="text-sm text-muted-foreground h-8 flex items-center">
                No verified identities. Add one in AWS SES / Settings.
              </p>
            ) : (
              <Select
                value={seq.fromEmail}
                onValueChange={(v) => {
                  if (!v) return;
                  setSeq({ ...seq, fromEmail: v });
                  saveMeta({ fromEmail: v });
                }}
              >
                <SelectTrigger className="w-full">
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
          {isFreemius && (
            <div className="space-y-2">
              <Label>Event field (dot-path to the event name)</Label>
              <Input
                className="font-mono"
                value={seq.eventField}
                placeholder="type"
                onChange={(e) => setSeq({ ...seq, eventField: e.target.value })}
                onBlur={() => saveMeta({ eventField: seq.eventField.trim() || "type" })}
              />
              <p className="text-xs text-muted-foreground">
                Which payload field holds the event name for auto-dispatch. Freemius uses{" "}
                <code>type</code>.
              </p>
            </div>
          )}
          <div className="space-y-2 sm:col-span-2">
            <Label>Recipient email field (dot-path in the webhook payload)</Label>
            <Input
              className="font-mono"
              value={seq.emailField}
              placeholder="objects.user.email"
              onChange={(e) => setSeq({ ...seq, emailField: e.target.value })}
              onBlur={() => saveMeta({ emailField: seq.emailField.trim() || "email" })}
            />
            <p className="text-xs text-muted-foreground">
              Where the recipient address lives in your posted JSON. Use <code>email</code> for a flat
              payload, or a path like <code>objects.user.email</code> for a nested one.
              {resolvedEmail && (
                <>
                  {" "}Resolves to <span className="text-foreground font-medium">{resolvedEmail}</span> for
                  the test payload.
                </>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sequence type */}
      <div className="mb-6">
        <Tabs
          value={seqType}
          onValueChange={(v) => {
            const val = (
              [
                "lead_nurture",
                "upsell",
                "cross_sell",
                "discount",
                "free_to_paid",
                "win_back",
                "renewal",
                "review_request",
                "gift_from_ceo",
              ] as string[]
            ).includes(v)
              ? (v as typeof seq.sequenceType)
              : "freemius_event";
            setSeq({ ...seq, sequenceType: val });
            saveMeta({ sequenceType: val });
          }}
        >
          <div className="overflow-x-auto pb-1">
            <TabsList>
              <TabsTrigger value="freemius_event" className="gap-1.5 whitespace-nowrap">
                <Zap className="h-3.5 w-3.5" /> Freemius Event Sequence
              </TabsTrigger>
              <TabsTrigger value="lead_nurture" className="gap-1.5 whitespace-nowrap">
                <Mail className="h-3.5 w-3.5" /> Lead Nurture &amp; Brand Familiarity Sequence
              </TabsTrigger>
              <TabsTrigger value="upsell" className="gap-1.5 whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5" /> Upsell
              </TabsTrigger>
              <TabsTrigger value="cross_sell" className="gap-1.5 whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5" /> Cross sell
              </TabsTrigger>
              <TabsTrigger value="discount" className="gap-1.5 whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5" /> Discount
              </TabsTrigger>
              <TabsTrigger value="free_to_paid" className="gap-1.5 whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5" /> Free user to Paid customer
              </TabsTrigger>
              <TabsTrigger value="win_back" className="gap-1.5 whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5" /> Win-back
              </TabsTrigger>
              <TabsTrigger value="renewal" className="gap-1.5 whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5" /> Renewal
              </TabsTrigger>
              <TabsTrigger value="review_request" className="gap-1.5 whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5" /> Review Request
              </TabsTrigger>
              <TabsTrigger value="gift_from_ceo" className="gap-1.5 whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5" /> Gift From CEO
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>
        <p className="text-xs text-muted-foreground mt-2">
          {isFreemius ? (
            <>
              Steps auto-fire by <strong>event type</strong> — POST your provider payload to{" "}
              <code>/send/{seq.id}</code> and the matching step sends.
            </>
          ) : (
            <>
              Fire each step explicitly by number — POST the contact payload to{" "}
              <code>/send/{seq.id}/{"{step}"}</code>. Design each email with AI.
            </>
          )}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Steps rail */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Email Steps
            </h2>
            <Button size="sm" variant="outline" className="gap-1" onClick={addStep}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {isFreemius && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => addEvents(POPULAR_EVENTS)}
                disabled={addingEvents}
                title="Add the 10 most useful Freemius lifecycle events as email steps"
              >
                {addingEvents ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Add 10 Event
              </Button>
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => addEvents(POPULAR_EVENTS_15)}
                disabled={addingEvents}
                title="Add 15 Freemius lifecycle events as email steps"
              >
                {addingEvents ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Add 15 Events
              </Button>
            </div>
          )}
          {!isFreemius && (
            <div className="grid gap-2 mb-3">
              {[5, 10, 15].map((n) => (
                <Button
                  key={n}
                  variant="secondary"
                  className="gap-2"
                  onClick={() => addTitledSteps(titledPreset, n)}
                  disabled={addingEvents}
                  title={`Add ${n} pre-titled ${titledLabel} steps`}
                >
                  {addingEvents ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Add {n} steps of this type
                </Button>
              ))}
            </div>
          )}
          {seq.steps.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="ghost" size="sm" className="w-full gap-2 mb-3 text-destructive hover:text-destructive" disabled={addingEvents} />
                }
              >
                <Trash2 className="h-4 w-4" /> Remove all Steps
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove all {seq.steps.length} steps?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes every email step in this sequence, including their
                    content and event types. The sequence itself is kept. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={removeAllSteps}>Remove all</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <div className="space-y-2">
            {seq.steps.length === 0 && (
              <p className="text-sm text-muted-foreground py-4">
                No steps yet. Add your first email.
              </p>
            )}
            {seq.steps.map((s) => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedStep(s.stepNumber)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedStep(s.stepNumber);
                  }
                }}
                className={cn(
                  "w-full cursor-pointer text-left rounded-lg border px-3 py-2.5 transition-colors",
                  selectedStep === s.stepNumber
                    ? "border-primary bg-primary/5"
                    : "hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0">
                    {s.stepNumber}
                  </span>
                  <span className="text-sm font-medium whitespace-nowrap">Email {s.stepNumber}</span>
                  {isFreemius ? (
                    <>
                      <span className="text-muted-foreground text-xs">–</span>
                      <StepEventField
                        value={s.eventType || ""}
                        onSave={(v) => saveStepEvent(s.stepNumber, v)}
                      />
                    </>
                  ) : s.name ? (
                    <span className="text-xs text-muted-foreground truncate">— {s.name}</span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-1 pl-8">
                  {s.subject || "No subject"}
                </p>
              </div>
            ))}
          </div>

          {/* Product-driven bulk AI generation — below all events */}
          <div className="rounded-lg border bg-muted/30 p-3 mt-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Sparkles className="h-3.5 w-3.5" /> AI from product
            </div>
            <Select
              value={selectedProductId}
              onValueChange={(v) => v && setSelectedProductId(v)}
              disabled={products.length === 0 || generatingAll}
              items={products.map((p) => ({ value: p.id, label: p.name }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={products.length ? "Select a product" : "No products — add in Settings"} />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full gap-2"
              onClick={generateAllSteps}
              disabled={generatingAll || !selectedProductId || seq.steps.length === 0}
              title="Generate an AI email for every step using the selected product's data"
            >
              {generatingAll ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating {genProgress}…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate all email steps
                </>
              )}
            </Button>
            {products.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Add products in Settings → App Settings → Product Settings.
              </p>
            )}
          </div>
        </div>

        {/* Step editor */}
        <div>
          {!draft ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Mail className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium">Select or add an email step</p>
                <p className="text-sm text-muted-foreground">
                  Each step is one email you can fire independently by its number.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Badge>Step {draft.stepNumber}</Badge>
                  <Input
                    className="h-8 w-56"
                    value={draft.name || ""}
                    placeholder={`Email ${draft.stepNumber}`}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </h3>
                <div className="flex items-center gap-2">
                  <Button className="gap-1.5" onClick={saveStep} disabled={savingStep}>
                    {savingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger render={<Button variant="outline" size="icon" />}>
                      <Trash2 className="h-4 w-4" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete step {draft.stepNumber}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Steps after it will be renumbered to stay contiguous, which changes their
                          webhook URLs.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteStep(draft.stepNumber)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Webhook URL for this step */}
              <Card className="bg-muted/40">
                <CardContent className="pt-6 space-y-3">
                  {isFreemius && (
                    <>
                      {/* Auto-dispatch by event type — one URL for the whole sequence */}
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Webhook className="h-4 w-4" /> Auto-fire by event type
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background rounded-md border px-3 py-2 overflow-x-auto whitespace-nowrap">
                          POST {eventWebhook}
                        </code>
                        <CopyButton text={eventWebhook} label="URL" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Point your plugin&apos;s webhook here. It reads{" "}
                        <code>{seq.eventField || "type"}</code> from the payload and fires whichever
                        step&apos;s event type matches
                        {draft.eventType ? (
                          <>
                            {" "}— this step fires on <code>{draft.eventType}</code>.
                          </>
                        ) : (
                          <> (set this step&apos;s event type in the left rail).</>
                        )}
                      </p>

                      <Separator />
                    </>
                  )}

                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Webhook className="h-4 w-4" /> Fire this exact step
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background rounded-md border px-3 py-2 overflow-x-auto whitespace-nowrap">
                      POST {stepWebhook}
                    </code>
                    <CopyButton text={stepWebhook} label="URL" />
                  </div>
                  <div className="flex items-start gap-2">
                    <pre className="flex-1 text-xs bg-background rounded-md border px-3 py-2 overflow-x-auto">
{curlExample}
                    </pre>
                    <CopyButton text={curlExample} label="cURL" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    POST the contact payload as JSON (must include <code>email</code>). Any field is
                    usable in the email as <code>{"{{fieldName}}"}</code> — e.g.{" "}
                    <code>{"{{firstName}}"}</code>.
                  </p>

                  <Separator />

                  {/* Test payload → live merge-tag preview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Test payload (JSON)</Label>
                      {parsedPayload.error ? (
                        <span className="text-xs text-destructive">{parsedPayload.error}</span>
                      ) : payloadKeys.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {payloadKeys.length} key{payloadKeys.length === 1 ? "" : "s"} available
                        </span>
                      ) : null}
                    </div>
                    <Textarea
                      className="font-mono text-xs"
                      rows={5}
                      spellCheck={false}
                      placeholder={'{\n  "email": "user@example.com",\n  "firstName": "Jane"\n}'}
                      value={testPayload}
                      onChange={(e) => setTestPayload(e.target.value)}
                    />
                    {payloadKeys.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-md border bg-background p-2">
                        {payloadKeys.map((fk) => (
                          <button
                            key={fk.path}
                            type="button"
                            title={fk.value ? `= ${fk.value}` : "Copy merge tag"}
                            className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs font-mono hover:bg-accent"
                            onClick={() => {
                              navigator.clipboard?.writeText(`{{${fk.path}}}`);
                              toast.success(`Copied {{${fk.path}}}`);
                            }}
                          >
                            {`{{${fk.path}}}`}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Paste a sample payload to preview how the subject and body render below. Nested
                      keys are flattened to dot-paths (e.g.{" "}
                      <code>{"{{objects.user.first}}"}</code>). Click any key to copy its merge tag.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* From name (sequence-level; supports placeholders) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>From name</Label>
                  <span className="text-[11px] text-muted-foreground">
                    Type <kbd className="rounded border px-1">/</kbd> to insert a placeholder
                  </span>
                </div>
                <PlaceholderInput
                  value={seq.fromName}
                  placeholder="bPlugins"
                  keys={payloadKeys}
                  onChange={(v) => setSeq({ ...seq, fromName: v })}
                  onCommit={(v) => saveMeta({ fromName: v.trim() || "bPlugins" })}
                />
                {seq.fromName.includes("{{") && !parsedPayload.error && (
                  <p className="text-xs text-muted-foreground">
                    Preview:{" "}
                    <span className="text-foreground font-medium">{resolveTags(seq.fromName)}</span>
                  </p>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Subject</Label>
                  <span className="text-[11px] text-muted-foreground">
                    Type <kbd className="rounded border px-1">/</kbd> to insert a placeholder
                  </span>
                </div>
                <PlaceholderInput
                  value={draft.subject}
                  placeholder="Welcome, {{objects.user.first}} 👋"
                  keys={payloadKeys}
                  onChange={(v) => setDraft({ ...draft, subject: v })}
                />
                {draft.subject.includes("{{") && !parsedPayload.error && (
                  <p className="text-xs text-muted-foreground">
                    Preview: <span className="text-foreground font-medium">{resolveTags(draft.subject)}</span>
                  </p>
                )}
              </div>

              {/* AI generation */}
              <Card className="border-primary/30">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-4 w-4 text-primary" /> Design with AI
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="Describe this email. e.g. A friendly welcome for a new user who just installed our plugin, with a link to docs."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <Select value={aiStyle} onValueChange={(v) => v && setAiStyle(v)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_STYLES.map((s) => (
                          <SelectItem key={s} value={s} className="capitalize">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={generateAi} disabled={generating} className="gap-1.5">
                      {generating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Generate
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Content preview / html */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Email content</Label>
                  {!parsedPayload.error && payloadKeys.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Preview merged with test payload
                    </span>
                  )}
                </div>
                <Tabs defaultValue="preview">
                  <TabsList>
                    <TabsTrigger value="preview" className="gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </TabsTrigger>
                    <TabsTrigger value="html" className="gap-1.5">
                      <Code className="h-3.5 w-3.5" /> HTML
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview">
                    <div className="rounded-lg border overflow-hidden bg-white">
                      <iframe
                        title="preview"
                        className="w-full h-[520px] bg-white"
                        srcDoc={
                          draft.htmlContent
                            ? resolveTags(draft.htmlContent)
                            : "<p style='font-family:sans-serif;color:#888;padding:24px'>Empty — generate or paste HTML.</p>"
                        }
                      />
                    </div>
                  </TabsContent>
                  <TabsContent value="html">
                    <Textarea
                      className="font-mono text-xs h-[520px]"
                      value={draft.htmlContent}
                      placeholder="<html>…</html>"
                      onChange={(e) => setDraft({ ...draft, htmlContent: e.target.value })}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              <Separator />
              <div className="flex justify-end">
                <Button className="gap-1.5" onClick={saveStep} disabled={savingStep}>
                  {savingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save step {draft.stepNumber}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
