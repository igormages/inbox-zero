import { describe, expect, it } from "vitest";
import { getChatHistoryLabel } from "./chat-history-types";

describe("getChatHistoryLabel", () => {
  const chat = {
    name: null,
    createdAt: new Date("2026-09-27T16:58:16.000Z"),
  };

  it("formats unnamed chats with a French label and date", () => {
    expect(getChatHistoryLabel(chat, "fr")).toMatch(
      /^Conversation du \d{2}\/\d{2}\/2026 à \d{2}:\d{2}$/,
    );
  });

  it("keeps a custom chat name unchanged", () => {
    expect(
      getChatHistoryLabel({ ...chat, name: "Plan de la journée" }, "fr"),
    ).toBe("Plan de la journée");
  });

  it("uses the original English fallback when the interface is English", () => {
    expect(getChatHistoryLabel(chat, "en")).toMatch(/^Chat from /);
  });
});
