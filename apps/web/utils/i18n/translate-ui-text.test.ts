import { describe, expect, it } from "vitest";
import { translateUiText } from "@/utils/i18n/translate-ui-text";

describe("translateUiText", () => {
  const translations = { Inbox: "Boîte de réception" };

  it("translates only an exact interface label and preserves spacing", () => {
    expect(translateUiText("  Inbox \n", translations)).toBe(
      "  Boîte de réception \n",
    );
    expect(translateUiText("Inbox from a customer", translations)).toBe(
      "Inbox from a customer",
    );
    expect(translateUiText("constructor", translations)).toBe("constructor");
  });
});
