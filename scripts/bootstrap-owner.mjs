#!/usr/bin/env node
/**
 * Owner bootstrap / promotion tool (operator-only, never shipped to the browser).
 *
 * Promotes an existing, confirmed Supabase Auth user to the OWNER role, or
 * demotes them back with `--revoke`. The user must sign up first — this script
 * never creates credentials, stores passwords, or leaves a permanent backdoor:
 * it authenticates with the service-role key that only the operator holds.
 *
 * Usage:
 *   node scripts/bootstrap-owner.mjs --email owner@example.com
 *   node scripts/bootstrap-owner.mjs --email owner@example.com --revoke
 *   node scripts/bootstrap-owner.mjs --email owner@example.com --dry-run
 *
 * Required environment (see .env.example):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;

    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  }
}

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function readFlag(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : (process.argv[index + 1] ?? true);
}

async function main() {
  loadEnvFiles();

  const emailFlag = readFlag("email");
  const email = (
    typeof emailFlag === "string" ? emailFlag : (process.env.OWNER_EMAIL ?? "")
  ).trim();
  const revoke = process.argv.includes("--revoke");
  const dryRun = process.argv.includes("--dry-run");
  const nextRole = revoke ? "CUSTOMER" : "OWNER";

  if (!email) fail("Pass the owner's email address: --email owner@example.com");

  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!supabaseUrl) fail("NEXT_PUBLIC_SUPABASE_URL is missing from the environment.");
  if (!serviceKey) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local (never commit it, never prefix it with NEXT_PUBLIC_).",
    );
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  // 1. Find the profile. A profile can only exist for an existing auth user
  //    (foreign key), so this also proves the account was created.
  const findUrl = `${supabaseUrl}/rest/v1/profiles?select=id,email,full_name,role,status&email=eq.${encodeURIComponent(
    email.toLowerCase(),
  )}`;
  const findResponse = await fetch(findUrl, { headers });
  if (!findResponse.ok) {
    fail(`Could not read profiles (HTTP ${findResponse.status}). Is the migration applied?`);
  }

  const [profile] = await findResponse.json();
  if (!profile) {
    fail(
      `No profile found for ${email}. Ask the owner to sign up at /signup and confirm the email, then re-run this script.`,
    );
  }

  if (profile.role === nextRole) {
    console.log(`\nℹ ${email} is already ${nextRole}. Nothing to do.`);
    return;
  }

  if (dryRun) {
    console.log(`\n… Dry run: would set role ${profile.role} → ${nextRole} for ${email}.`);
    return;
  }

  // 2. Apply the role change with the service role (allowed; the escalation
  //    guard only blocks anon/authenticated requests).
  const updateUrl = `${supabaseUrl}/rest/v1/profiles?id=eq.${profile.id}&select=id,email,role,status`;
  const updateResponse = await fetch(updateUrl, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({ role: nextRole }),
  });

  if (!updateResponse.ok) {
    const detail = await updateResponse.text();
    fail(`Role update failed (HTTP ${updateResponse.status}): ${detail}`);
  }

  const [updated] = await updateResponse.json();

  // 3. Report the auth state so an unconfirmed email is never a surprise.
  let confirmed = "unknown";
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${profile.id}`, { headers });
  if (userResponse.ok) {
    const user = await userResponse.json();
    confirmed = user?.email_confirmed_at ? "yes" : "no";
  }

  console.log(`\n✔ ${email}`);
  console.log(`  role     ${profile.role} → ${updated?.role ?? nextRole}`);
  console.log(`  status   ${updated?.status ?? "unchanged"}`);
  console.log(`  email confirmed: ${confirmed}`);

  if (confirmed === "no") {
    console.log("  ⚠ The email is not confirmed yet, so this account cannot sign in.");
  }

  console.log(
    nextRole === "OWNER"
      ? "  → Sign in at /owner/login to reach the owner area.\n"
      : "  → Owner access revoked; the account is a normal customer again.\n",
  );
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
