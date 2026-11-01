import Link from "next/link";
import { cn } from "cn";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-5 py-16 text-center sm:px-8">
      <p className="font-heading text-5xl font-semibold tracking-tight text-primary">404</p>
      <div className="grid gap-2">
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          We could not find that page
        </h1>
        <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
          The link may be old, or the page may have moved. The bakery counter is still open.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className={cn(buttonVariants({ size: "lg" }), "h-11 rounded-xl px-5 text-sm")}
        >
          Back to home
        </Link>
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "h-11 rounded-xl bg-card px-5 text-sm",
          )}
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
