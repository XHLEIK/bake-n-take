"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signInWithOAuthAction } from "@/lib/actions/auth";
import { INITIAL_AUTH_FORM_STATE } from "@/lib/auth/form-state";

import { InlineMessage } from "./inline-message";

/** Official Google "G" mark, inlined to avoid a third-party asset request. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

/** Official Facebook "f" mark. */
function FacebookMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.42c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z"
      />
    </svg>
  );
}

function OAuthSubmit({ label, mark }: { label: string; mark: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      aria-busy={pending || undefined}
      className="h-[var(--auth-oauth-h,3rem)] w-full min-w-0 rounded-2xl border-border/70 bg-card/85 text-sm font-medium shadow-[0_1px_0_rgb(255_255_255/0.5)_inset,0_10px_24px_-18px_rgb(66_40_16/0.4)] transition-all duration-200 hover:-translate-y-px hover:bg-card hover:shadow-[0_1px_0_rgb(255_255_255/0.5)_inset,0_16px_30px_-18px_rgb(66_40_16/0.45)] active:translate-y-0 dark:border-white/10 dark:bg-white/5 dark:shadow-none dark:hover:bg-white/10 [&_svg]:size-5"
    >
      {pending ? (
        <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" />
      ) : (
        <span className="shrink-0">{mark}</span>
      )}
      <span className="truncate">
        {pending ? `Connecting to ${label}…` : `Continue with ${label}`}
      </span>
    </Button>
  );
}

/**
 * Google and Facebook sign-in.
 *
 * Both buttons submit the same server action, which asks Supabase for the
 * provider URL (PKCE). The redirect is performed server-side, so the flow works
 * even before client JavaScript loads.
 */
export function OAuthButtons({ next }: { next?: string }) {
  const [googleState, googleAction] = useActionState(
    signInWithOAuthAction,
    INITIAL_AUTH_FORM_STATE,
  );
  const [facebookState, facebookAction] = useActionState(
    signInWithOAuthAction,
    INITIAL_AUTH_FORM_STATE,
  );

  const failure =
    googleState.status === "error"
      ? googleState.message
      : facebookState.status === "error"
        ? facebookState.message
        : undefined;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {/* Side by side from small tablets up: the labels never truncate, and the
          pair occupies a single row on desktop to keep the panel compact. */}
      <form action={googleAction}>
        <input type="hidden" name="provider" value="google" />
        <input type="hidden" name="next" value={next ?? ""} />
        <OAuthSubmit label="Google" mark={<GoogleMark />} />
      </form>

      <form action={facebookAction}>
        <input type="hidden" name="provider" value="facebook" />
        <input type="hidden" name="next" value={next ?? ""} />
        <OAuthSubmit label="Facebook" mark={<FacebookMark />} />
      </form>

      {failure ? <InlineMessage variant="error" message={failure} /> : null}
    </div>
  );
}
