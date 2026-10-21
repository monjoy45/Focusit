/** Binds a checkbox to a boolean setting. Returns a function that re-renders it from state. */
export function bindSwitch(el: HTMLInputElement, onChange: (value: boolean) => Promise<void>): (value: boolean) => void {
  el.addEventListener('change', () => {
    const wanted = el.checked;
    onChange(wanted).catch(() => { el.checked = !wanted; });
  });
  return (value) => { el.checked = value; };
}

/** Binds a <select> to a string-valued setting. Returns a function that re-renders it from state. */
export function bindSelect<T extends string>(el: HTMLSelectElement, onChange: (value: T) => Promise<void>): (value: T) => void {
  el.addEventListener('change', () => {
    const wanted = el.value as T;
    onChange(wanted).catch(() => { /* a settings-change event will correct the displayed value */ });
  });
  return (value) => { el.value = value; };
}
