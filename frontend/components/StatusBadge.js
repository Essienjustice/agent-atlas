export function StatusBadge({ status }) {
  const config = {
    OPEN: { label: "OPEN", className: "status OPEN" },
    ASSIGNED: { label: "ASSIGNED", className: "status ASSIGNED" },
    COMPLETED: { label: "COMPLETED", className: "status COMPLETED" },
    FAILED: { label: "FAILED", className: "status FAILED" }
  };

  const key = String(status);
  const c = config[key] ??
    config[key.toUpperCase()] ??
    {
      label: key,
      className: "muted"
    };

  return (
    <span className={c.className}>
      {c.label}
    </span>
  );
}
