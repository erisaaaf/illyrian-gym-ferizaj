import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useId } from "react";
import { ChevronDown } from "lucide-react";

function Label({ id, children, required }: { id: string; children: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={id} className="mb-1.5 block text-xs font-bold text-text-secondary">
      {children}
      {required && (
        <span className="text-danger" aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </label>
  );
}

export const fieldClass =
  "w-full rounded-md border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition focus:border-ink disabled:bg-surface-sunken disabled:opacity-70 aria-[invalid=true]:border-danger";

function Hint({ id, hint, error }: { id: string; hint?: React.ReactNode; error?: string }) {
  if (error) {
    return (
      <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-danger">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="mt-1.5 text-xs text-text-muted">
      {hint}
    </p>
  ) : null;
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
}

export function TextField({ label, required, hint, error, className = "", id, ...rest }: TextFieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="mb-4">
      <Label id={fieldId} required={required}>
        {label}
      </Label>
      <input
        id={fieldId}
        className={`${fieldClass} ${className}`}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${fieldId}-hint` : undefined}
        {...rest}
      />
      <Hint id={`${fieldId}-hint`} hint={hint} error={error} />
    </div>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
}

export function TextAreaField({ label, required, hint, error, className = "", id, ...rest }: TextAreaFieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="mb-4">
      <Label id={fieldId} required={required}>
        {label}
      </Label>
      <textarea
        id={fieldId}
        className={`${fieldClass} min-h-[88px] ${className}`}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${fieldId}-hint` : undefined}
        {...rest}
      />
      <Hint id={`${fieldId}-hint`} hint={hint} error={error} />
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
}

export function SelectField({ label, required, hint, error, className = "", children, id, ...rest }: SelectFieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="mb-4">
      <Label id={fieldId} required={required}>
        {label}
      </Label>
      <div className="relative">
        <select
          id={fieldId}
          className={`${fieldClass} appearance-none pr-9 ${className}`}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? `${fieldId}-hint` : undefined}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
      </div>
      <Hint id={`${fieldId}-hint`} hint={hint} error={error} />
    </div>
  );
}

/** Checkbox with a visible label, for opt-ins and settings. */
export function CheckboxField({ label, hint, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="mb-4 flex items-start gap-3">
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-border-strong accent-ink" {...rest} />
      <label htmlFor={id} className="text-sm text-text-primary">
        {label}
        {hint && <span className="mt-0.5 block text-xs text-text-muted">{hint}</span>}
      </label>
    </div>
  );
}
