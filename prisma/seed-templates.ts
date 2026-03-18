import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// bPlugins brand colors
const PRIMARY = "#146ef5";
const SECONDARY = "#ff7a00";
const TITLE_COLOR = "#070127";
const BODY_COLOR = "#485781";
const BG_COLOR = "#f4f6f9";
const CARD_BG = "#ffffff";

// Shared header used by all templates
function emailHeader() {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};padding:0;margin:0;">
<tr><td align="center" style="padding:0;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:0 auto;">
<!-- Header -->
<tr>
  <td style="background-color:#070127;padding:20px 32px;text-align:left;">
    <a href="https://bplugins.com" style="text-decoration:none;">
      <img src="https://bplugins.com/wp-content/themes/b-technologies/assets/images/logo/logo-2.svg" alt="bPlugins" width="140" style="display:block;border:0;height:auto;" />
    </a>
  </td>
</tr>`;
}

// Shared footer used by all templates
function emailFooter() {
  return `
<!-- Footer -->
<tr>
  <td style="background-color:${TITLE_COLOR};padding:32px;text-align:center;">
    <!-- Social Links -->
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;">
      <tr>
        <td style="padding:0 8px;">
          <a href="https://facebook.com/bplugins" style="text-decoration:none;color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;">Facebook</a>
        </td>
        <td style="color:#555;font-size:13px;">|</td>
        <td style="padding:0 8px;">
          <a href="https://twitter.com/jesuspended" style="text-decoration:none;color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;">Twitter</a>
        </td>
        <td style="color:#555;font-size:13px;">|</td>
        <td style="padding:0 8px;">
          <a href="https://youtube.com/@bplugins" style="text-decoration:none;color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;">YouTube</a>
        </td>
        <td style="color:#555;font-size:13px;">|</td>
        <td style="padding:0 8px;">
          <a href="https://linkedin.com/company/bplugins" style="text-decoration:none;color:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;">LinkedIn</a>
        </td>
      </tr>
    </table>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#9ca3af;margin:0 0 8px 0;line-height:1.6;">
      bPlugins LLC &middot; 8 The Green, Suite 300, Dover, DE 19901, USA
    </p>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#9ca3af;margin:0 0 8px 0;line-height:1.6;">
      &copy; ${new Date().getFullYear()} bPlugins. All rights reserved.
    </p>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#9ca3af;margin:0;line-height:1.6;">
      <a href="{{unsubscribeUrl}}" style="color:${SECONDARY};text-decoration:underline;">Unsubscribe</a> from these emails
    </p>
  </td>
</tr>
</table>
</td></tr></table>`;
}

// Helper to wrap body content with shared header + footer
function wrapEmail(bodyHtml: string): string {
  return emailHeader() + bodyHtml + emailFooter();
}

// Styled CTA button
function ctaButton(text: string, href: string, bg: string = PRIMARY): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px auto;">
      <tr>
        <td style="background-color:${bg};padding:12px 32px;">
          <a href="${href}" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;display:inline-block;">${text}</a>
        </td>
      </tr>
    </table>`;
}

// Divider line
function divider(): string {
  return `<tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></td></tr>`;
}

// --- Template 1: Product Update ---
const productUpdateBody = `
<tr>
  <td style="background-color:${CARD_BG};padding:32px 32px 8px 32px;">
    <h1 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:${TITLE_COLOR};margin:0 0 6px 0;">Product Update</h1>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:0 0 20px 0;line-height:1.6;">Here\u2019s what\u2019s new in your favorite bPlugins products.</p>
  </td>
</tr>
${divider()}
<tr>
  <td style="background-color:${CARD_BG};padding:24px 32px;">
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 16px 0;line-height:1.7;">
      Hi {{firstName}},
    </p>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 16px 0;line-height:1.7;">
      We\u2019ve been working hard to make your experience even better. This update includes performance improvements, bug fixes, and quality-of-life enhancements across our plugin suite.
    </p>
    <h2 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:${TITLE_COLOR};margin:0 0 12px 0;">What\u2019s Improved</h2>
    <ul style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 16px 0;padding-left:20px;line-height:1.8;">
      <li>Faster page load times with optimized asset delivery</li>
      <li>Improved compatibility with WordPress 6.5+</li>
      <li>Resolved styling conflicts with popular themes</li>
      <li>Better error handling and user-facing messages</li>
    </ul>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 8px 0;line-height:1.7;">
      Update your plugins today to enjoy these improvements.
    </p>
    ${ctaButton("Update Now", "https://bplugins.com/downloads")}
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:0;line-height:1.6;">
      Thank you for choosing bPlugins.<br/>
      \u2014 The bPlugins Team
    </p>
  </td>
</tr>`;

// --- Template 2: Security Update ---
const securityUpdateBody = `
<tr>
  <td style="background-color:${CARD_BG};padding:32px 32px 8px 32px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background-color:#dc2626;padding:4px 12px;margin-bottom:8px;">
        <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1px;">Security Alert</span>
      </td>
    </tr></table>
    <h1 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:${TITLE_COLOR};margin:12px 0 6px 0;">Important Security Update</h1>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:0 0 20px 0;line-height:1.6;">Please update your plugins immediately to stay protected.</p>
  </td>
</tr>
${divider()}
<tr>
  <td style="background-color:${CARD_BG};padding:24px 32px;">
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 16px 0;line-height:1.7;">
      Hi {{firstName}},
    </p>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 16px 0;line-height:1.7;">
      We\u2019ve identified and patched a security vulnerability that could affect your WordPress site. We recommend updating to the latest version as soon as possible.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="background-color:#fef2f2;padding:16px 20px;border-left:4px solid #dc2626;">
          <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#991b1b;margin:0;font-weight:600;">Action Required</p>
          <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:#991b1b;margin:4px 0 0 0;line-height:1.6;">Go to your WordPress dashboard &rarr; Plugins &rarr; Update the affected bPlugins products to the latest version.</p>
        </td>
      </tr>
    </table>
    <h2 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:${TITLE_COLOR};margin:0 0 12px 0;">What Was Patched</h2>
    <ul style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 16px 0;padding-left:20px;line-height:1.8;">
      <li>Fixed an XSS vulnerability in the settings panel</li>
      <li>Strengthened input sanitization on public-facing forms</li>
      <li>Updated third-party dependencies with known CVEs</li>
    </ul>
    ${ctaButton("Update Plugins Now", "https://bplugins.com/downloads", "#dc2626")}
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:0;line-height:1.6;">
      Your site\u2019s security is our top priority.<br/>
      \u2014 The bPlugins Security Team
    </p>
  </td>
</tr>`;

// --- Template 3: New Feature ---
const newFeatureBody = `
<tr>
  <td style="background-color:${CARD_BG};padding:32px 32px 8px 32px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background-color:${SECONDARY};padding:4px 12px;">
        <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1px;">New Feature</span>
      </td>
    </tr></table>
    <h1 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:${TITLE_COLOR};margin:12px 0 6px 0;">Say Hello to a Powerful New Feature</h1>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:0 0 20px 0;line-height:1.6;">We\u2019ve built something you\u2019ve been asking for.</p>
  </td>
</tr>
${divider()}
<tr>
  <td style="background-color:${CARD_BG};padding:24px 32px;">
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 16px 0;line-height:1.7;">
      Hi {{firstName}},
    </p>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 16px 0;line-height:1.7;">
      We\u2019re excited to announce a brand new feature that makes building with bPlugins faster and more flexible than ever.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background-color:#eff6ff;padding:20px;border-left:4px solid ${PRIMARY};">
          <h3 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:${TITLE_COLOR};margin:0 0 8px 0;">Conditional Display Logic</h3>
          <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:0;line-height:1.6;">Show or hide any block based on user role, device type, date range, or custom conditions. No code required.</p>
        </td>
      </tr>
    </table>
    <h2 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:${TITLE_COLOR};margin:0 0 12px 0;">How It Helps You</h2>
    <ul style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 16px 0;padding-left:20px;line-height:1.8;">
      <li>Create personalized experiences without plugins stacking</li>
      <li>Schedule content visibility by date and time</li>
      <li>Target logged-in vs. guest users with different content</li>
    </ul>
    ${ctaButton("Try It Now", "https://bplugins.com/docs/conditional-logic", SECONDARY)}
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:0;line-height:1.6;">
      We\u2019d love to hear what you think!<br/>
      \u2014 The bPlugins Team
    </p>
  </td>
</tr>`;

// --- Template 4: Monthly Newsletter ---
const monthlyNewsletterBody = `
<tr>
  <td style="background-color:${CARD_BG};padding:32px 32px 8px 32px;">
    <h1 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:${TITLE_COLOR};margin:0 0 4px 0;">Monthly Newsletter</h1>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:0 0 20px 0;line-height:1.6;">Your monthly dose of tips, updates, and community highlights.</p>
  </td>
</tr>
${divider()}
<tr>
  <td style="background-color:${CARD_BG};padding:24px 32px;">
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 16px 0;line-height:1.7;">
      Hi {{firstName}},
    </p>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 20px 0;line-height:1.7;">
      Here\u2019s everything that happened at bPlugins this month.
    </p>

    <!-- Section: Product Updates -->
    <h2 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:${PRIMARY};margin:0 0 10px 0;">\uD83D\uDE80 Product Updates</h2>
    <ul style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 20px 0;padding-left:20px;line-height:1.8;">
      <li><strong>Starter Templates v3.2</strong> \u2014 Added 15 new starter site designs</li>
      <li><strong>Block Editor Plus v2.8</strong> \u2014 New animation controls and responsive options</li>
      <li><strong>Performance boost</strong> \u2014 20% faster load times across all plugins</li>
    </ul>

    <!-- Section: Tips -->
    <h2 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:${PRIMARY};margin:0 0 10px 0;">\uD83D\uDCA1 Tip of the Month</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background-color:#f0fdf4;padding:16px 20px;border-left:4px solid #16a34a;">
          <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#15803d;margin:0;line-height:1.6;">
            <strong>Speed up your workflow:</strong> Use our global style presets to apply consistent spacing, colors, and typography across your entire site in one click.
          </p>
        </td>
      </tr>
    </table>

    <!-- Section: Community -->
    <h2 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:${PRIMARY};margin:0 0 10px 0;">\uD83C\uDF1F Community Spotlight</h2>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 20px 0;line-height:1.7;">
      This month we hit <strong>50,000+ active installations</strong> across our free plugins. Thank you for being part of the bPlugins community!
    </p>

    ${ctaButton("Read Full Changelog", "https://bplugins.com/changelog")}
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:0;line-height:1.6;">
      See you next month!<br/>
      \u2014 The bPlugins Team
    </p>
  </td>
</tr>`;

// --- Template 5: New Version Release ---
const newVersionReleaseBody = `
<tr>
  <td style="background-color:${CARD_BG};padding:32px 32px 8px 32px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background-color:${PRIMARY};padding:4px 12px;">
        <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1px;">New Release</span>
      </td>
    </tr></table>
    <h1 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;color:${TITLE_COLOR};margin:12px 0 6px 0;">Version 4.0 Is Here!</h1>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:0 0 20px 0;line-height:1.6;">A major release packed with new capabilities and improvements.</p>
  </td>
</tr>
${divider()}
<tr>
  <td style="background-color:${CARD_BG};padding:24px 32px;">
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 16px 0;line-height:1.7;">
      Hi {{firstName}},
    </p>
    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${BODY_COLOR};margin:0 0 20px 0;line-height:1.7;">
      We\u2019re thrilled to announce the release of <strong>Version 4.0</strong> \u2014 our biggest update yet. This version has been months in the making based on your feedback.
    </p>

    <h2 style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;color:${TITLE_COLOR};margin:0 0 12px 0;">What\u2019s New in v4.0</h2>

    <!-- Feature 1 -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      <tr>
        <td style="background-color:#eff6ff;padding:14px 16px;">
          <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${TITLE_COLOR};margin:0;font-weight:600;">\u2728 Redesigned Editor Interface</p>
          <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:4px 0 0 0;line-height:1.5;">Cleaner layout, faster interactions, and a more intuitive workflow.</p>
        </td>
      </tr>
    </table>

    <!-- Feature 2 -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
      <tr>
        <td style="background-color:#fff7ed;padding:14px 16px;">
          <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${TITLE_COLOR};margin:0;font-weight:600;">\u26A1 Performance Engine</p>
          <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:4px 0 0 0;line-height:1.5;">Up to 40% faster rendering with our new lightweight CSS engine.</p>
        </td>
      </tr>
    </table>

    <!-- Feature 3 -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="background-color:#f0fdf4;padding:14px 16px;">
          <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:${TITLE_COLOR};margin:0;font-weight:600;">\uD83D\uDD17 REST API Support</p>
          <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:4px 0 0 0;line-height:1.5;">Full REST API for headless WordPress and custom integrations.</p>
        </td>
      </tr>
    </table>

    ${ctaButton("Download v4.0", "https://bplugins.com/downloads")}

    <p style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;color:${BODY_COLOR};margin:0;line-height:1.6;">
      Check the <a href="https://bplugins.com/changelog" style="color:${PRIMARY};text-decoration:underline;">full changelog</a> for all the details.<br/>
      \u2014 The bPlugins Team
    </p>
  </td>
</tr>`;

// All 5 templates
const templates = [
  {
    name: "Product Update",
    subject: "What's New at bPlugins — Product Update",
    htmlContent: wrapEmail(productUpdateBody),
  },
  {
    name: "Security Update",
    subject: "Important Security Update — Action Required",
    htmlContent: wrapEmail(securityUpdateBody),
  },
  {
    name: "New Feature Announcement",
    subject: "Introducing a Powerful New Feature in bPlugins",
    htmlContent: wrapEmail(newFeatureBody),
  },
  {
    name: "Monthly Newsletter",
    subject: "bPlugins Monthly — Updates, Tips & Community",
    htmlContent: wrapEmail(monthlyNewsletterBody),
  },
  {
    name: "New Version Release",
    subject: "Version 4.0 Is Here — Our Biggest Update Yet",
    htmlContent: wrapEmail(newVersionReleaseBody),
  },
];

async function main() {
  // Find the super_admin user to use as creator
  const admin = await prisma.user.findFirst({ where: { role: "super_admin" } });
  if (!admin) {
    console.error("No super_admin user found. Please create one first.");
    process.exit(1);
  }

  console.log("Seeding email templates...");

  for (const tpl of templates) {
    // Skip if a template with the same name already exists
    const existing = await prisma.emailTemplate.findFirst({ where: { name: tpl.name } });
    if (existing) {
      console.log(`  Skipping "${tpl.name}" — already exists`);
      continue;
    }

    await prisma.emailTemplate.create({
      data: {
        name: tpl.name,
        subject: tpl.subject,
        htmlContent: tpl.htmlContent,
        createdBy: admin.id,
      },
    });
    console.log(`  Created "${tpl.name}"`);
  }

  console.log("Done seeding templates.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
