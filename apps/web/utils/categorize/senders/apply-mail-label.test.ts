import { beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/utils/__mocks__/prisma";
import { createTestLogger } from "@/__tests__/helpers";
import { applySenderCategoryMailLabel } from "@/utils/categorize/senders/apply-mail-label";

vi.mock("@/utils/prisma");

const logger = createTestLogger();

describe("applySenderCategoryMailLabel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies a categorized sender's Gmail label to a new inbox message", async () => {
    prisma.newsletter.findFirst.mockResolvedValue({
      category: { mailLabelId: "Label_123" },
    } as never);
    const labelMessage = vi.fn().mockResolvedValue({});

    await applySenderCategoryMailLabel({
      emailAccountId: "account-1",
      message: {
        id: "message-1",
        headers: { from: "Sender <SENDER@example.com>" },
        labelIds: ["INBOX"],
      } as never,
      provider: {
        name: "google",
        isSentMessage: () => false,
        labelMessage,
      } as never,
      logger,
    });

    expect(prisma.newsletter.findFirst).toHaveBeenCalledWith({
      where: {
        emailAccountId: "account-1",
        email: { equals: "sender@example.com", mode: "insensitive" },
      },
      select: { category: { select: { mailLabelId: true } } },
    });
    expect(labelMessage).toHaveBeenCalledWith({
      messageId: "message-1",
      labelId: "Label_123",
      labelName: null,
    });
  });

  it("does not label sent mail or repeat a label already on the message", async () => {
    const labelMessage = vi.fn();
    const provider = {
      name: "google",
      isSentMessage: () => true,
      labelMessage,
    } as never;

    await applySenderCategoryMailLabel({
      emailAccountId: "account-1",
      message: {
        id: "message-1",
        headers: { from: "sender@example.com" },
        labelIds: ["INBOX"],
      } as never,
      provider,
      logger,
    });

    expect(prisma.newsletter.findFirst).not.toHaveBeenCalled();
    expect(labelMessage).not.toHaveBeenCalled();

    prisma.newsletter.findFirst.mockResolvedValue({
      category: { mailLabelId: "Label_123" },
    } as never);
    await applySenderCategoryMailLabel({
      emailAccountId: "account-1",
      message: {
        id: "message-2",
        headers: { from: "sender@example.com" },
        labelIds: ["INBOX", "Label_123"],
      } as never,
      provider: { ...provider, isSentMessage: () => false } as never,
      logger,
    });
    expect(labelMessage).not.toHaveBeenCalled();
  });
});
