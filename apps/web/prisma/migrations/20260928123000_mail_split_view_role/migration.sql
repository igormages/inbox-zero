ALTER TABLE "MailSplit"
ADD COLUMN "excludeFromOther" BOOLEAN NOT NULL DEFAULT true;

UPDATE "MailSplit" AS split
SET "excludeFromOther" = false
WHERE EXISTS (
  SELECT 1 FROM "MailSplitFilter" AS filter
  WHERE filter."mailSplitId" = split."id"
)
AND NOT EXISTS (
  SELECT 1 FROM "MailSplitFilter" AS filter
  WHERE filter."mailSplitId" = split."id"
    AND filter."kind" NOT IN ('UNREAD', 'STARRED')
);
