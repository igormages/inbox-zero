export function translateUiText(
  value: string,
  translations: Record<string, string>,
): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(value);
  if (!match) return value;

  const [, before, content, after] = match;
  const key = content.replace(/\s+/g, " ");
  const translated = Object.hasOwn(translations, key)
    ? translations[key]
    : undefined;
  return typeof translated === "string" && translated
    ? `${before}${translated}${after}`
    : value;
}
