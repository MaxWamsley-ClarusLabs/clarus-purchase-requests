import * as React from 'react';
import { INSTRUCTIONS } from '../../content/instructions';
import { useDialogFocus } from '../hooks';
import { Icon } from './Icon';

/** The Instructions panel (travel D-036). It takes the keyboard while open, like a dialog. */
export function InstructionsDrawer(props: { onClose: () => void }): React.ReactElement {
  const ref = React.useRef<HTMLElement>(null);
  useDialogFocus(ref, props.onClose);
  return (
    <>
      <div className="ctx-backdrop" onClick={props.onClose} />
      <aside ref={ref} className="ctx-drawer" role="dialog" aria-modal="true" aria-label="Instructions" tabIndex={-1}>
        <div className="ctx-row-flex" style={{ justifyContent: 'space-between' }}>
          <h2>How to make a purchase request</h2>
          <button className="ctx-btn ctx-btn-ghost ctx-btn-small" onClick={props.onClose} aria-label="Close instructions">
            <Icon name="x" />
          </button>
        </div>
        {INSTRUCTIONS.map((section) => (
          <section key={section.heading}>
            <h3>{section.heading}</h3>
            {section.paragraphs?.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {section.bullets ? (
              <ul>
                {section.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </aside>
    </>
  );
}
