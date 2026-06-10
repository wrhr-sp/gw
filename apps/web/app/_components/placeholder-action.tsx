type PlaceholderActionProps = {
  label: string;
  hint: string;
  tone?: "primary" | "secondary";
};

export function PlaceholderAction({ label, hint, tone = "primary" }: PlaceholderActionProps) {
  const className = tone === "secondary" ? "touch-button--secondary placeholder-action__button" : "touch-button placeholder-action__button";

  return (
    <div className="placeholder-action">
      <button type="button" className={className} disabled>
        {label}
      </button>
      <p className="placeholder-action__hint">{hint}</p>
    </div>
  );
}
