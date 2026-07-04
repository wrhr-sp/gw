import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldProps = LabelHTMLAttributes<HTMLLabelElement> & {
  label: ReactNode;
  helperText?: ReactNode;
  children: ReactNode;
};

export function FormGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={["form-grid", "form-grid--two", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function FormField({ label, helperText, children, className = "", ...props }: FieldProps) {
  return (
    <label className={["form-field", className].filter(Boolean).join(" ")} {...props}>
      <span className="form-field__label">{label}</span>
      {children}
      {helperText ? <small className="form-field__helper">{helperText}</small> : null}
    </label>
  );
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={["form-control", className].filter(Boolean).join(" ")} {...props} />;
}

export function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <TextInput type="number" {...props} />;
}

export function DateInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <TextInput type="date" {...props} />;
}

export function SelectInput({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={["form-control", "form-control--select", className].filter(Boolean).join(" ")} {...props}>{children}</select>;
}

export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={["form-control", "form-control--textarea", className].filter(Boolean).join(" ")} {...props} />;
}

export function FormSubmitButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={["form-action", "feature-workspace__row-action", className].filter(Boolean).join(" ")} type="submit" {...props} />;
}
