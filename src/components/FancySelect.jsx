import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export function FancySelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const listId = useId();
  const selected = options.find((opt) => opt.id === value) || options[0];

  const updateMenuPosition = () => {
    if (!rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const menuWidth = Math.max(rect.width, compact ? 140 : 160);
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - menuWidth - 8);
    }
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left,
      minWidth: menuWidth,
      zIndex: 80,
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, compact]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      className={[
        'fancy-select',
        open ? 'is-open' : '',
        compact ? 'fancy-select--compact' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      ref={rootRef}
    >
      <button
        type="button"
        className="fancy-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {selected?.dot ? (
          <span className="fancy-select-dot" style={{ background: selected.dot }} />
        ) : null}
        <span className="fancy-select-label">{selected?.label}</span>
        <span className="fancy-select-chevron" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <ul
          className="fancy-select-menu"
          id={listId}
          role="listbox"
          style={menuStyle || undefined}
        >
          {options.map((opt) => {
            const active = opt.id === value;
            return (
              <li key={opt.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`fancy-select-option${active ? ' is-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.id);
                    setOpen(false);
                  }}
                >
                  {opt.dot ? (
                    <span className="fancy-select-dot" style={{ background: opt.dot }} />
                  ) : null}
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
