import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-1 block text-xs font-medium text-text-secondary">
      {children}
      {required && <span className="text-danger"> *</span>}
    </label>
  );
}

const fieldClass =
  "w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-50";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  hint?: string;
}

export function TextField({ label, required, hint, className = "", ...rest }: TextFieldProps) {
  return (
    <div className="mb-4">
      <Label required={required}>{label}</Label>
      <input className={`${fieldClass} ${className}`} required={required} {...rest} />
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  required?: boolean;
}

export function TextAreaField({ label, required, className = "", ...rest }: TextAreaFieldProps) {
  return (
    <div className="mb-4">
      <Label required={required}>{label}</Label>
      <textarea className={`${fieldClass} min-h-[80px] ${className}`} required={required} {...rest} />
    </div>
  );
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  required?: boolean;
}

export function SelectField({ label, required, className = "", children, ...rest }: SelectFieldProps) {
  return (
    <div className="mb-4">
      <Label required={required}>{label}</Label>
      <select className={`${fieldClass} ${className}`} required={required} {...rest}>
        {children}
      </select>
    </div>
  );
}
