import * as React from 'react';
import { Layer, filterLayers } from '../../domain/ledgerSuggestions';

let comboCount = 0;

/**
 * A dropdown you can type into (P-055): it opens on the layered suggestions, typing narrows it, the arrow keys move and
 * Enter chooses. The page decides the layers; this only shows them. The list is drawn at a fixed place on the screen so
 * a table's own scrolling never clips it, and it follows its box when the page scrolls. The typed text is never kept:
 * only a chosen item is (so only text from the lists reaches the data).
 */
export function Combobox(props: {
  /** What a screen reader calls it, such as "PR-0042 row 1 account". */
  label: string;
  /** The chosen item's exact text, or ''. */
  value: string;
  /** Builds the layers when the list opens, so a page with many rows builds one at a time and never all at once. */
  getLayers: () => readonly Layer[];
  disabled?: boolean;
  /** Shown when nothing is chosen. */
  placeholder?: string;
  invalid?: boolean;
  /** Offer "None" while something is chosen. Off for an account that only shows its category's starting point. */
  allowClear?: boolean;
  /** Called with the chosen item's text, or '' for "none". */
  onChoose: (text: string) => void;
}): React.ReactElement {
  const id = React.useMemo(() => `ctx-combo-${++comboCount}`, []);
  const input = React.useRef<HTMLInputElement>(null);
  const list = React.useRef<HTMLUListElement>(null);
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [place, setPlace] = React.useState<{ left: number; top: number; width: number; above: boolean } | null>(null);
  const [layers, setLayers] = React.useState<readonly Layer[]>([]);

  const shown = React.useMemo(() => (open ? filterLayers(layers, typed) : []), [open, layers, typed]);
  const items = React.useMemo(() => shown.flatMap((layer) => layer.items), [shown]);
  const hasClear = open && props.allowClear !== false && props.value !== '' && typed.trim() === '';
  // The "none" choice comes first when something is chosen; options are numbered after it.
  const options = React.useMemo(() => (hasClear ? ['', ...items] : items), [hasClear, items]);

  const close = React.useCallback(() => {
    setOpen(false);
    setTyped('');
  }, []);

  /** Where the list goes: just under the box, or just over it when there is little room below. Fixed to the screen. */
  const measure = React.useCallback(() => {
    const box = input.current?.getBoundingClientRect();
    if (!box) return;
    const room = window.innerHeight - box.bottom;
    const width = Math.min(Math.max(box.width, 340), window.innerWidth - 16);
    // Kept inside the window, so a box at the right edge of a wide table never opens a list that runs off the screen.
    const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 12));
    setPlace({ left, top: box.bottom + 2, width, above: room < 280 && box.top > room });
  }, []);

  const openList = () => {
    if (props.disabled) return;
    measure();
    const built = props.getLayers();
    setLayers(built);
    setTyped('');
    // Start on the chosen item, else the first.
    const clearOffered = props.allowClear !== false && props.value !== '';
    const start =
      props.value === '' ? 0 : Math.max(0, (clearOffered ? ['', ...built.flatMap((l) => l.items)] : built.flatMap((l) => l.items)).indexOf(props.value));
    setActive(start);
    setOpen(true);
  };

  // While the list is open it follows its box when the page or the table scrolls, and when the window changes size. Focusing a box in a wide table
  // can itself scroll the table sideways, so scrolling must never close the list.
  React.useEffect(() => {
    if (!open) return;
    const follow = (e: Event) => {
      // Scrolling the list itself is not the page moving.
      if (e.type === 'scroll' && list.current && e.target instanceof Node && list.current.contains(e.target)) return;
      measure();
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, [open, measure]);

  // Keeps the chosen item in view inside the list. Done by moving the list's own scroll, never the page's: scrolling the page would close the list.
  React.useEffect(() => {
    const box = list.current;
    const item = box ? box.querySelector<HTMLElement>('[data-active="true"]') : null;
    if (!open || !box || !item) return;
    if (item.offsetTop < box.scrollTop) box.scrollTop = item.offsetTop - 6;
    else if (item.offsetTop + item.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = item.offsetTop + item.offsetHeight - box.clientHeight + 6;
  }, [open, active, typed]);

  const choose = (text: string) => {
    close();
    if (text !== props.value) props.onChoose(text);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (props.disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        openList();
        return;
      }
      if (options.length === 0) return;
      setActive((a) => (e.key === 'ArrowDown' ? Math.min(options.length - 1, a + 1) : Math.max(0, a - 1)));
    } else if (e.key === 'Enter') {
      if (open) {
        e.preventDefault();
        if (options.length > 0) choose(options[Math.min(active, options.length - 1)]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    } else if (e.key === 'Tab') {
      close();
    }
  };

  // Option numbers run through every layer, after the "none" choice.
  let number = hasClear ? 1 : 0;
  const optionId = (n: number) => `${id}-opt-${n}`;

  return (
    <div className="ctx-combo">
      <input
        ref={input}
        className={`ctx-cell ctx-combo-input ${props.invalid ? 'blocking' : ''} ${props.value === '' ? 'unchosen' : ''}`}
        role="combobox"
        aria-label={props.label}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && options.length > 0 ? optionId(Math.min(active, options.length - 1)) : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={props.disabled}
        placeholder={props.value || props.placeholder || 'Choose'}
        value={open ? typed : props.value}
        title={props.value}
        onFocus={openList}
        onClick={() => {
          if (!open) openList();
        }}
        onChange={(e) => {
          setTyped(e.target.value);
          setActive(0);
          if (!open) setOpen(true);
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      {open && place ? (
        <ul
          ref={list}
          id={`${id}-list`}
          className="ctx-combo-list"
          role="listbox"
          aria-label={props.label}
          style={
            place.above
              ? { left: place.left, bottom: window.innerHeight - place.top + 30, width: place.width }
              : { left: place.left, top: place.top, width: place.width }
          }
          // Keeps the box focused while an item is clicked, so choosing never loses the typing place first.
          onMouseDown={(e) => e.preventDefault()}
        >
          {hasClear ? (
            <li
              id={optionId(0)}
              role="option"
              aria-selected={false}
              data-active={active === 0}
              className={`ctx-combo-option ctx-combo-none ${active === 0 ? 'active' : ''}`}
              onMouseEnter={() => setActive(0)}
              onClick={() => choose('')}
            >
              None (clear this)
            </li>
          ) : null}
          {shown.length === 0 ? (
            <li className="ctx-combo-empty" role="presentation">
              Nothing in the list matches &quot;{typed}&quot;.
            </li>
          ) : null}
          {shown.map((layer) => (
            <React.Fragment key={layer.id}>
              <li className="ctx-combo-heading" role="presentation">
                {layer.title}
              </li>
              {layer.items.map((item) => {
                const n = number++;
                return (
                  <li
                    key={item}
                    id={optionId(n)}
                    role="option"
                    aria-selected={item === props.value}
                    data-active={active === n}
                    className={`ctx-combo-option ${active === n ? 'active' : ''} ${item === props.value ? 'selected' : ''}`}
                    onMouseEnter={() => setActive(n)}
                    onClick={() => choose(item)}
                  >
                    {item}
                  </li>
                );
              })}
            </React.Fragment>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
