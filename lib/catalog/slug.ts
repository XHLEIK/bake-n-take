/**
 * URL slug helpers (Phase 3).
 *
 * Slugs are the public identity for products and categories. They are
 * generated once at creation from the name and then kept stable, so renames
 * never break existing links (a future phase can add redirect history on top).
 */

/** "Chocolate Truffle Cake!" → "chocolate-truffle-cake". */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug.length > 0 ? slug : "item";
}

/**
 * First unused slug: base, base-2, base-3, … `taken` is the set of slugs the
 * caller already read from the database (case-insensitive match).
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((slug) => slug.toLowerCase()));
  const root = slugify(base);
  if (!used.has(root)) return root;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}
