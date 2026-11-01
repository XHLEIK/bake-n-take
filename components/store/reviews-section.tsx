import { Quote } from "lucide-react";

import { SectionHeader } from "@/components/site/section-header";
import { createClient } from "@/lib/supabase/server";

type CustomerReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  author: string | null;
  createdAt: string | null;
};

function mapReview(row: Record<string, unknown>): CustomerReview | null {
  if (typeof row.id !== "string") return null;
  if (typeof row.rating !== "number" || row.rating < 1 || row.rating > 5) return null;
  if (typeof row.body !== "string" || row.body.trim().length === 0) return null;
  const authorRaw =
    typeof row.author_name === "string" && row.author_name.trim().length > 0
      ? row.author_name.trim()
      : typeof (row.profiles as Record<string, unknown> | null | undefined)?.full_name === "string"
        ? ((row.profiles as Record<string, unknown>).full_name as string).trim()
        : null;
  return {
    id: row.id,
    rating: Math.round(row.rating),
    title: typeof row.title === "string" && row.title.length > 0 ? row.title : null,
    body: row.body.trim(),
    author: authorRaw,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

/**
 * Customer reviews section.
 *
 * Reads the store's REAL `product_reviews` rows when the table exists
 * (owner-managed or customer-submitted, enforced by RLS either way). No
 * table yet, or no reviews yet: an honest, calm empty state — never fake
 * quotes. Recent positive word-of-mouth only; order is newest first.
 */
export async function ReviewsSection() {
  const supabase = await createClient();
  let reviews: CustomerReview[] = [];

  try {
    const { data, error } = await supabase
      .from("product_reviews")
      .select("id, rating, title, body, author_name, created_at")
      .order("created_at", { ascending: false })
      .limit(6);
    if (!error && Array.isArray(data)) {
      reviews = (data as Record<string, unknown>[])
        .map(mapReview)
        .filter((review): review is CustomerReview => review !== null);
    }
  } catch {
    reviews = [];
  }

  if (reviews.length === 0) {
    return (
      <section aria-label="Customer reviews" className="grid gap-4">
        <SectionHeader eyebrow="Word of mouth" title="From our counter" />
        <p className="mx-auto max-w-md rounded-3xl border border-dashed border-border px-6 py-10 text-center text-sm leading-relaxed text-pretty text-muted-foreground">
          We are new here — no reviews yet. Order a box, taste it, and this space is yours.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Customer reviews" className="grid gap-6">
      <SectionHeader eyebrow="Word of mouth" title="From our counter" />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="relative grid content-start gap-3 rounded-3xl border border-border/70 bg-card/70 p-6 shadow-[0_1px_0_rgb(255_255_255/0.5)_inset] dark:border-white/10 dark:shadow-none"
          >
            <Quote aria-hidden="true" className="absolute top-5 right-5 size-5 text-primary/25" />
            <span
              aria-label={`Rated ${review.rating} out of 5`}
              className="flex gap-0.5 text-primary"
            >
              {Array.from({ length: 5 }, (_, index) => (
                <Star key={index} filled={index < review.rating} />
              ))}
            </span>
            {review.title ? (
              <p className="font-heading text-base font-semibold">{review.title}</p>
            ) : null}
            <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
              {review.body}
            </p>
            <p className="text-xs text-muted-foreground/85">
              {review.author ?? "A Bake n Take customer"}
              {review.createdAt
                ? ` · ${new Date(review.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}`
                : ""}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
    >
      <path d="M10 1.7l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z" />
    </svg>
  );
}
