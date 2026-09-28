import type { ParsedMessage } from "@/utils/types";
import type { EmailProvider } from "@/utils/email/types";
import type { Logger } from "@/utils/logger";
import { extractEmailAddress } from "@/utils/email";
import prisma from "@/utils/prisma";

export async function applySenderCategoryMailLabel({
  emailAccountId,
  message,
  provider,
  logger,
}: {
  emailAccountId: string;
  message: ParsedMessage;
  provider: EmailProvider;
  logger: Logger;
}) {
  if (
    provider.name !== "google" ||
    provider.isSentMessage(message) ||
    !message.labelIds?.includes("INBOX")
  )
    return;

  const email = extractEmailAddress(message.headers.from).toLowerCase();
  if (!email) return;

  try {
    const sender = await prisma.newsletter.findFirst({
      where: {
        emailAccountId,
        email: { equals: email, mode: "insensitive" },
      },
      select: { category: { select: { mailLabelId: true } } },
    });
    const labelId = sender?.category?.mailLabelId;
    if (!labelId || message.labelIds?.includes(labelId)) return;

    await provider.labelMessage({
      messageId: message.id,
      labelId,
      labelName: null,
    });
  } catch (error) {
    logger.warn("Could not apply sender category label", { error });
  }
}
