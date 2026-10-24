// Pretty-printed JSON with light syntax coloring, built from React elements
// (never innerHTML), so whatever the machine returns stays inert text.
const TOKEN =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

const classFor = (token: string) => {
  if (token.startsWith('"'))
    return token.trimEnd().endsWith(":") ? "text-ink" : "text-[var(--s3)]";
  if (token === "true" || token === "false") return "text-[var(--s7)]";
  if (token === "null") return "text-ink-3";
  return "text-[var(--s1)]";
};

export const JsonView = ({ value }: { value: unknown }) => {
  const text = JSON.stringify(value, null, 2) ?? "undefined";
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) nodes.push(text.slice(last, index));
    nodes.push(
      <span key={index} className={classFor(match[0])}>
        {match[0]}
      </span>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <>{nodes}</>;
};
