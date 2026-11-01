#!/usr/bin/env node
/**
 * Fresh-start reset (operator-only, local dev — never shipped to the browser).
 *
 * Default (full reset):
 *   1. Deletes EVERY auth user (profiles cascade via the FK).
 *   2. Creates ADMIN_EMAIL with the email pre-confirmed.
 *   3. Promotes it to OWNER and verifies the result.
 *
 * With --promote-only: skips the wipe and creation, only promotes the
 * existing ADMIN_EMAIL account (used after applying migrations late).
 *
 * Required environment (see .env.example — never commit these):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD
 *
 * Usage:
 *   node scripts/reset-project.mjs
 *   node scripts/reset-project.mjs --promote-only
 *   node scripts/reset-project.mjs --dry-run
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

async function main() {
  loadEnvFiles();

  const promoteOnly = process.argv.includes("--promote-only");
  const dryRun = process.argv.includes("--dry-run");

  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const adminPassword = (process.env.ADMIN_PASSWORD ?? "").trim();

  if (!supabaseUrl) fail("NEXT_PUBLIC_SUPABASE_URL is missing from the environment.");
  if (!serviceKey) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local (never commit it, never prefix it with NEXT_PUBLIC_).",
    );
  }
  if (!adminEmail || !adminEmail.includes("@")) fail("Set ADMIN_EMAIL in .env.local.");
  if (adminPassword.length < 6) fail("Set ADMIN_PASSWORD in .env.local (6+ characters).");

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  // 0. Schema check: the profiles table (and trigger) must exist before any
  //    account can work with the app.
  const schemaResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=0`, {
    headers,
  });
  const schemaReady = schemaResponse.ok;
  if (!schemaReady) {
    console.log("\n⚠ public.profiles is not reachable — migrations are not applied yet.");
    console.log("  The wipe/creation below still works, but promotion cannot.");
  }

  if (dryRun) {
    console.log(
      `\n… Dry run: would ${promoteOnly ? "promote" : "wipe all users, create, and promote"} ${adminEmail}.`,
    );
    return;
  }

  // 1. Wipe every auth user (profiles cascade).
  let wiped = 0;
  if (!promoteOnly) {
    for (;;) {
      const listResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=100`, {
        headers,
      });
      if (!listResponse.ok) fail(`Could not list users (HTTP ${listResponse.status}).`);
      const { users } = await listResponse.json();
      if (!users || users.length === 0) break;

      for (const user of users) {
        const deleteResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
          method: "DELETE",
          headers,
        });
        if (!deleteResponse.ok) {
          fail(`Could not delete user ${user.id} (HTTP ${deleteResponse.status}).`);
        }
        wiped += 1;
      }
    }
    console.log(`\n✔ Wiped ${wiped} auth user(s).`);
  }

  // 2. Create the admin, pre-confirmed so no email step can block sign-in.
  let adminId = null;
  if (!promoteOnly) {
    const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: { full_name: "Bakery Owner" },
      }),
    });
    if (!createResponse.ok) {
      fail(
        `Could not create ${adminEmail} (HTTP ${createResponse.status}): ${await createResponse.text()}`,
      );
    }
    const created = await createResponse.json();
    adminId = created?.id ?? created?.user?.id;
    if (!adminId) fail("Create-user response did not include an id.");
    console.log(`✔ Created ${adminEmail} (pre-confirmed).`);
  }

  // 3. Promote to OWNER (service role is allowed; the escalation guard only
  //    blocks anon/authenticated requests).
  if (schemaReady) {
    const targetId = adminId ?? (await findUserIdByEmail(supabaseUrl, headers, adminEmail, fail));
    if (!targetId) fail(`No account found for ${adminEmail}.`);

    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${targetId}&select=id,email,role,status`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ role: "OWNER" }),
      },
    );
    if (!updateResponse.ok) {
      fail(`Role update failed (HTTP ${updateResponse.status}): ${await updateResponse.text()}`);
    }
    const [updated] = await updateResponse.json();
    console.log(`✔ Promoted ${adminEmail} → ${updated?.role ?? "OWNER"}.`);
  } else {
    console.log("\n⚠ Skipped promotion: apply the migrations first, then re-run with:");
    console.log("    node scripts/reset-project.mjs --promote-only");
    console.log("  Migration files: supabase/migrations/*.sql (paste into the SQL editor).");
    return;
  }

  // 4. Final verification.
  const verifyResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=100`, {
    headers,
  });
  const { users } = await verifyResponse.json();
  console.log(`\n✔ Project now holds ${users.length} auth user(s):`);
  for (const user of users) {
    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=email,role,status&id=eq.${user.id}`,
      { headers },
    );
    const [profile] = profileResponse.ok ? await profileResponse.json() : [];
    console.log(
      `  - ${user.email} | confirmed: ${user.email_confirmed_at ? "yes" : "no"} | role: ${profile?.role ?? "?"} | status: ${profile?.status ?? "?"}`,
    );
  }
  console.log("  → Sign in at /owner/login to reach the owner area.\n");
}

async function findUserIdByEmail(supabaseUrl, headers, email, fail) {
  const listResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=100`, { headers });
  if (!listResponse.ok) fail(`Could not list users (HTTP ${listResponse.status}).`);
  const { users } = await listResponse.json();
  return users.find((user) => (user.email ?? "").toLowerCase() === email)?.id ?? null;
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
