import { type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, useId } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  help?: string;
  error?: string | undefined;
}

/** Campo con etiqueta, ayuda y error (sistema visual, TextField). */
export function TextField({ label, help, error, required, ...input }: TextFieldProps) {
  const id = useId();
  const msg = error ?? help;
  return (
    <div className={`gz-field${error ? ' gz-field--error' : ''}`}>
      <label className="gz-field__label" htmlFor={id}>
        {label}
        {required && <span className="gz-field__req" aria-hidden="true"> *</span>}
      </label>
      <div className="gz-input">
        <input
          id={id}
          className="gz-input__el"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={msg ? `${id}-msg` : undefined}
          {...input}
        />
      </div>
      {msg && <p id={`${id}-msg`} className={error ? 'gz-field__error' : 'gz-field__help'}>{msg}</p>}
    </div>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export function Button({ variant = 'secondary', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={`gz-btn gz-btn--${variant}${className ? ` ${className}` : ''}`} {...rest} />;
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: readonly { value: string; label: string }[];
  help?: string;
  error?: string | undefined;
}

/** Desplegable con etiqueta, ayuda y error. */
export function SelectField({ label, options, help, error, ...select }: SelectFieldProps) {
  const id = useId();
  const msg = error ?? help;
  return (
    <div className={`gz-field${error ? ' gz-field--error' : ''}`}>
      <label className="gz-field__label" htmlFor={id}>{label}</label>
      <div className="gz-input">
        <select id={id} className="gz-input__el" aria-invalid={error ? true : undefined} aria-describedby={msg ? `${id}-msg` : undefined} {...select}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {msg && <p id={`${id}-msg`} className={error ? 'gz-field__error' : 'gz-field__help'}>{msg}</p>}
    </div>
  );
}

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string;
  help?: string;
  error?: string | undefined;
}

/** Casilla con su texto al lado. */
export function CheckboxField({ label, help, error, ...input }: CheckboxFieldProps) {
  const id = useId();
  const msg = error ?? help;
  return (
    <div className={`gz-check${error ? ' gz-field--error' : ''}`}>
      <input id={id} type="checkbox" aria-describedby={msg ? `${id}-msg` : undefined} {...input} />
      <label htmlFor={id} className="body">{label}</label>
      {msg && <p id={`${id}-msg`} className={error ? 'gz-field__error' : 'gz-field__help'}>{msg}</p>}
    </div>
  );
}
