import {
  SESv2Client,
  SendEmailCommand,
  GetAccountCommand,
  ListEmailIdentitiesCommand,
  GetEmailIdentityCommand,
} from "@aws-sdk/client-sesv2";
import { prisma } from "./db";

let sesClient: SESv2Client | null = null;

export async function getSesConfig() {
  return prisma.sesConfig.findFirst({ where: { isActive: true } });
}

export async function getSesClient(): Promise<SESv2Client | null> {
  const config = await getSesConfig();
  if (!config) return null;

  if (!sesClient) {
    sesClient = new SESv2Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return sesClient;
}

export function resetSesClient() {
  sesClient = null;
}

export async function verifySesConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = await getSesClient();
    if (!client) return { success: false, error: "No SES configuration found" };

    await client.send(new GetAccountCommand({}));
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

// List verified email identities from SES
export async function listVerifiedIdentities(): Promise<{
  identities: { identity: string; type: string; verified: boolean }[];
  error?: string;
}> {
  try {
    const client = await getSesClient();
    if (!client) return { identities: [], error: "No SES configuration found" };

    const listResult = await client.send(new ListEmailIdentitiesCommand({ PageSize: 100 }));
    const items = listResult.EmailIdentities || [];

    const identities: { identity: string; type: string; verified: boolean }[] = [];

    for (const item of items) {
      if (!item.IdentityName) continue;

      // Get verification status
      try {
        const detail = await client.send(
          new GetEmailIdentityCommand({ EmailIdentity: item.IdentityName })
        );
        identities.push({
          identity: item.IdentityName,
          type: item.IdentityType || "UNKNOWN",
          verified: detail.VerifiedForSendingStatus ?? false,
        });
      } catch {
        identities.push({
          identity: item.IdentityName,
          type: item.IdentityType || "UNKNOWN",
          verified: false,
        });
      }
    }

    return { identities };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { identities: [], error: message };
  }
}

export interface SendEmailParams {
  to: string[];
  subject: string;
  htmlBody: string;
  fromEmail: string;
  fromName: string;
  campaignId?: string;
  unsubscribeUrl?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ messageId?: string; error?: string }> {
  try {
    const config = await getSesConfig();
    if (!config) return { error: "No SES configuration found" };

    const client = await getSesClient();
    if (!client) return { error: "Could not create SES client" };

    // Add unsubscribe header and footer per SES best practices
    const unsubscribeLink = params.unsubscribeUrl || "";
    const htmlWithUnsubscribe = params.htmlBody + (unsubscribeLink
      ? `<div style="text-align:center;margin-top:32px;padding:16px;font-size:12px;color:#999;">
          <a href="${unsubscribeLink}" style="color:#999;">Unsubscribe from these emails</a>
        </div>`
      : "");

    const headers: Record<string, string> = {};
    if (unsubscribeLink) {
      headers["List-Unsubscribe"] = `<${unsubscribeLink}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }

    const fromAddress = params.fromName
      ? `${params.fromName} <${params.fromEmail}>`
      : params.fromEmail;

    const baseInput = {
      FromEmailAddress: fromAddress,
      Destination: {
        ToAddresses: params.to,
      },
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: htmlWithUnsubscribe, Charset: "UTF-8" },
          },
          Headers: Object.entries(headers).map(([Name, Value]) => ({ Name, Value })),
        },
      },
    };

    // Try with configuration set first, fallback without it if it doesn't exist
    if (config.configSetName) {
      try {
        const result = await client.send(
          new SendEmailCommand({ ...baseInput, ConfigurationSetName: config.configSetName })
        );
        return { messageId: result.MessageId };
      } catch (sendError: unknown) {
        const errMsg = sendError instanceof Error ? sendError.message : "";
        if (errMsg.includes("Configuration set")) {
          // Config set doesn't exist in SES — retry without it
          const result = await client.send(new SendEmailCommand(baseInput));
          return { messageId: result.MessageId };
        }
        throw sendError;
      }
    }

    const result = await client.send(new SendEmailCommand(baseInput));
    return { messageId: result.MessageId };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { error: message };
  }
}

// Send emails in batches with rate limiting (SES best practice)
export async function sendBulkEmails(
  emails: { to: string; subject: string; htmlBody: string; fromEmail: string; fromName: string; unsubscribeUrl: string }[],
  campaignId: string,
  ratePerSecond: number = 10
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const result = await sendEmail({
      to: [email.to],
      subject: email.subject,
      htmlBody: email.htmlBody,
      fromEmail: email.fromEmail,
      fromName: email.fromName,
      campaignId,
      unsubscribeUrl: email.unsubscribeUrl,
    });

    if (result.messageId) {
      sent++;
      // Record sent event. We deliberately do NOT write a "delivered" event
      // here — SES accepting the SendEmailCommand only means it was queued for
      // sending; the email can still bounce. The SNS Delivery notification is
      // the single source of truth for "delivered".
      await prisma.campaignEvent.create({
        data: {
          campaignId,
          email: email.to,
          eventType: "sent",
          metadata: JSON.stringify({ messageId: result.messageId }),
        },
      });
    } else {
      failed++;
      errors.push(`${email.to}: ${result.error}`);
      await prisma.campaignEvent.create({
        data: {
          campaignId,
          email: email.to,
          eventType: "failed",
          metadata: JSON.stringify({ error: result.error }),
        },
      });
    }

    // Rate limiting
    if ((i + 1) % ratePerSecond === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { sent, failed, errors };
}
