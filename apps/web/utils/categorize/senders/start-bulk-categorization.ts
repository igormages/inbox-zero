import type { Logger } from "@/utils/logger";
import prisma from "@/utils/prisma";
import { defaultCategory } from "@/utils/categories";
import type { EmailProvider } from "@/utils/email/types";
import {
  deleteCategorizationProgress,
  getCategorizationProgress,
  getCategorizationStatusSnapshot,
  type CategorizationStatusSnapshot,
  saveCategorizationTotalItems,
} from "@/utils/redis/categorization-progress";
import {
  deleteEmptyCategorizeSendersQueues,
  publishToAiCategorizeSendersQueue,
} from "@/utils/upstash/categorize-senders";
import { getUncategorizedSenders } from "@/utils/categorize/senders/get-uncategorized-senders";
import { loadEmails } from "@/utils/actions/stats-loading";
import { getProviderRateLimitDelayMs } from "@/utils/email/rate-limit";

// Leave Gmail capacity for the user's interactive inbox searches. A full
// mailbox backfill can use tens of thousands of Gmail quota units.
const CATEGORIZE_SYNC_CHUNK_PAGES = 1;
const LIMIT = 100;
const MAX_SENDERS = 2000;
const MAX_SYNC_PASSES = 2;

export type StartBulkCategorizationResult = {
  started: boolean;
  alreadyRunning: boolean;
  totalQueuedSenders: number;
  autoCategorizeSenders: boolean;
  senderDiscoveryIncomplete: boolean;
  progress: CategorizationStatusSnapshot;
};

export async function startBulkCategorization({
  emailAccountId,
  emailProvider,
  logger,
}: {
  emailAccountId: string;
  emailProvider: EmailProvider;
  logger: Logger;
}): Promise<StartBulkCategorizationResult> {
  const existingProgress = await getCategorizationProgress({ emailAccountId });

  if (existingProgress?.status === "running") {
    logger.info("Sender categorization already running", {
      totalItems: existingProgress.totalItems,
      completedItems: existingProgress.completedItems,
    });

    return {
      started: false,
      alreadyRunning: true,
      totalQueuedSenders: existingProgress.totalItems,
      autoCategorizeSenders: true,
      senderDiscoveryIncomplete: true,
      progress: getCategorizationStatusSnapshot(existingProgress),
    };
  }

  if (existingProgress) {
    await deleteCategorizationProgress({ emailAccountId });
  }

  logger.info("Starting sender categorization");

  await ensureDefaultCategories({ emailAccountId });

  await prisma.emailAccount.update({
    where: { id: emailAccountId },
    data: { autoCategorizeSenders: true },
  });

  deleteEmptyCategorizeSendersQueues({
    skipEmailAccountId: emailAccountId,
  }).catch((error) => {
    logger.error("Error deleting empty categorize queues", { error });
  });

  let totalQueuedSenders = 0;
  let syncPasses = 0;
  let shouldLoadMoreMessages = true;
  let senderDiscoveryIncomplete = false;
  const queuedSenderEmails = new Set<string>();

  async function queueDiscoveredSenders() {
    let currentOffset: number | undefined = 0;

    while (currentOffset !== undefined && totalQueuedSenders < MAX_SENDERS) {
      const result = await getUncategorizedSenders({
        emailAccountId,
        limit: LIMIT,
        offset: currentOffset,
      });

      logger.trace("Got uncategorized senders", {
        uncategorizedSenders: result.uncategorizedSenders.length,
      });

      const sendersToQueue = result.uncategorizedSenders.filter((sender) => {
        const senderKey = sender.email.trim().toLowerCase();
        if (queuedSenderEmails.has(senderKey)) return false;
        queuedSenderEmails.add(senderKey);
        return true;
      });

      if (sendersToQueue.length > 0) {
        totalQueuedSenders += sendersToQueue.length;

        await saveCategorizationTotalItems({
          emailAccountId,
          totalItems: totalQueuedSenders,
        });

        await publishToAiCategorizeSendersQueue({
          emailAccountId,
          senders: sendersToQueue,
        });
      }

      if (totalQueuedSenders >= MAX_SENDERS) {
        logger.info("Reached max sender categorization limit", {
          maxSenders: MAX_SENDERS,
        });
        break;
      }

      currentOffset = result.nextOffset;
    }
  }

  await queueDiscoveredSenders();

  while (
    totalQueuedSenders < MAX_SENDERS &&
    shouldLoadMoreMessages &&
    syncPasses < MAX_SYNC_PASSES
  ) {
    let syncResult: Awaited<ReturnType<typeof loadEmails>>;
    try {
      syncResult = await loadEmails(
        {
          emailAccountId,
          emailProvider,
          logger,
        },
        {
          loadBefore: true,
          maxPages: CATEGORIZE_SYNC_CHUNK_PAGES,
        },
      );
    } catch (error) {
      const throttled =
        getProviderRateLimitDelayMs({
          error,
          provider: "google",
          attemptNumber: 1,
        }) !== null ||
        getProviderRateLimitDelayMs({
          error,
          provider: "microsoft",
          attemptNumber: 1,
        }) !== null;
      if (!throttled) throw error;
      logger.warn("Sender discovery paused by provider rate limit", { error });
      senderDiscoveryIncomplete = true;
      break;
    }

    const loadedMoreMessages =
      syncResult.loadedAfterMessages > 0 || syncResult.loadedBeforeMessages > 0;

    logger.info("Categorize sync pass completed", {
      syncPasses,
      loadedAfterMessages: syncResult.loadedAfterMessages,
      loadedBeforeMessages: syncResult.loadedBeforeMessages,
      hasMoreAfter: syncResult.hasMoreAfter,
      hasMoreBefore: syncResult.hasMoreBefore,
      totalQueuedSenders,
    });

    shouldLoadMoreMessages = loadedMoreMessages;
    syncPasses++;
    if (loadedMoreMessages) await queueDiscoveredSenders();
  }

  senderDiscoveryIncomplete ||=
    shouldLoadMoreMessages && syncPasses >= MAX_SYNC_PASSES;

  if (totalQueuedSenders === 0) {
    logger.info("No senders queued for categorization");

    return {
      started: false,
      alreadyRunning: false,
      totalQueuedSenders: 0,
      autoCategorizeSenders: true,
      senderDiscoveryIncomplete,
      progress: {
        status: senderDiscoveryIncomplete ? "idle" : "completed",
        totalItems: 0,
        completedItems: 0,
        remainingItems: 0,
        message: senderDiscoveryIncomplete
          ? "Sender discovery is incomplete. Try again after the provider rate limit resets."
          : "No uncategorized senders to categorize.",
      },
    };
  }

  logger.info("Queued senders for categorization", {
    totalQueuedSenders,
    syncPasses,
    shouldLoadMoreMessages,
  });

  const progress = await getCategorizationProgress({ emailAccountId });

  return {
    started: true,
    alreadyRunning: false,
    totalQueuedSenders,
    autoCategorizeSenders: true,
    senderDiscoveryIncomplete,
    progress: getCategorizationStatusSnapshot(progress),
  };
}

async function ensureDefaultCategories({
  emailAccountId,
}: {
  emailAccountId: string;
}) {
  const categoriesToCreate = Object.values(defaultCategory)
    .filter((category) => category.enabled)
    .map((category) => ({
      emailAccountId,
      name: category.name,
      description: category.description,
    }));

  await prisma.category.createMany({
    data: categoriesToCreate,
    skipDuplicates: true,
  });
}
