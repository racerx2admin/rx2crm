export default async function Login({ searchParams }: { searchParams: Promise<{ wrong?: string }> }) {
  const { wrong } = await searchParams;
  return (
    <main className="login">
      <h1>RX2 Sponsors</h1>
      <form method="post" action="/api/login">
        <label>
          Team password
          <input type="password" name="password" autoFocus required />
        </label>
        {wrong && <p className="error">That password didn't work.</p>}
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
