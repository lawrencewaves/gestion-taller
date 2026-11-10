import { type ButtonHTMLAttributes, type InputHTMLAttributes, useId } from 'react';

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
