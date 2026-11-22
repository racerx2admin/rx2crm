export const AUTH_COOKIE = "rx2_auth";

/** The cookie holds a SHA-256 of the team password, so the password itself is never stored in the browser. */
export async function passwordToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`rx2crm:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
