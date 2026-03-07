export function TokenDiagnostics({
  loading,
  status,
  session,
  tokenSummary,
  fullToken,
}: {
  loading: boolean;
  status: string;
  session: unknown;
  tokenSummary: { present: boolean; length: number; preview: string | null };
  fullToken: string | null;
}) {
  return (
    <>
      {tokenSummary.present ? (
        <p>
          Token loaded. Length: <strong>{tokenSummary.length}</strong>
        </p>
      ) : (
        <p className="muted">Token not loaded yet.</p>
      )}

      <pre>
        {JSON.stringify(
          { loading, status, session, token: tokenSummary },
          null,
          2,
        )}
      </pre>

      {tokenSummary.present && fullToken ? (
        <details>
          <summary>Show full token</summary>
          <pre>{fullToken}</pre>
        </details>
      ) : null}
    </>
  );
}
