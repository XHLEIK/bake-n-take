import { vi } from "vitest";

/**
 * Test doubles for the Supabase boundary.
 *
 * Tests never talk to a real project: the server client is replaced with these
 * fakes, so unit and integration runs are hermetic and cannot touch data.
 */

export type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
};

export type SupabaseError = { code?: string; message: string; status?: number };

export type SupabaseResult<T> = { data: T; error: SupabaseError | null };

export class RedirectSignal extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT:${url}`);
    this.name = "RedirectSignal";
  }
}

export type ProfileQueryMock = {
  select: (columns?: string) => ProfileQueryMock;
  eq: (column: string, value: string) => ProfileQueryMock;
  maybeSingle: () => Promise<SupabaseResult<ProfileRow | null>>;
};

export type SupabaseMockState = {
  profile: ProfileRow | null;
  /** When set, the profiles query fails with this error. */
  profileError: SupabaseError | null;
};

export type SupabaseMock = {
  state: SupabaseMockState;
  client: unknown;
  auth: Record<string, ReturnType<typeof vi.fn>>;
  query: ProfileQueryMock;
};

export function profileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    full_name: "Aarav Sharma",
    email: "aarav@example.com",
    phone: null,
    role: "CUSTOMER",
    status: "ACTIVE",
    ...overrides,
  };
}

/** Creates a fake Supabase client with a mutable profile row. */
export function createSupabaseMock(
  initial: { profile?: ProfileRow | null; user?: { id: string } | null } = {},
): SupabaseMock {
  const state: SupabaseMockState = {
    profile: initial.profile === undefined ? profileRow() : initial.profile,
    profileError: null,
  };

  const user = initial.user === undefined ? { id: profileRow().id } : initial.user;

  const query: ProfileQueryMock = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => {
      if (state.profileError) return { data: null, error: state.profileError };
      return { data: state.profile, error: null };
    }),
  };

  const auth = {
    signInWithPassword: vi.fn(
      async (): Promise<SupabaseResult<{ user: { id: string } | null; session: unknown }>> => ({
        data: { user, session: user ? { access_token: "test" } : null },
        error: null,
      }),
    ),
    signUp: vi.fn(async () => ({ data: { user, session: null }, error: null })),
    signInWithOAuth: vi.fn(async () => ({
      data: { url: "https://accounts.google.com/o/oauth2/auth?client_id=test" },
      error: null,
    })),
    signOut: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
    resend: vi.fn(async () => ({ data: {}, error: null })),
    updateUser: vi.fn(async () => ({ data: { user }, error: null })),
    getUser: vi.fn(async () => ({ data: { user }, error: null })),
    exchangeCodeForSession: vi.fn(async () => ({ data: { user, session: {} }, error: null })),
    verifyOtp: vi.fn(async () => ({ data: { user, session: {} }, error: null })),
  };

  const client = {
    auth,
    from: vi.fn(() => query),
  };

  return { state, client, auth, query };
}

/** Marks a member of the returned auth mock as failing with `error`. */
export function failWith(mock: SupabaseMock, member: string, error: SupabaseError) {
  mock.auth[member]?.mockResolvedValue({ data: { user: null, session: null, url: null }, error });
}
