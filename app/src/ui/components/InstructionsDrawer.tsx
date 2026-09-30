import * as React from 'react';
import { INSTRUCTIONS } from '../../content/instructions';
import { Icon } from './Icon';

/** The Instructions panel (D-036). */
export function InstructionsDrawer(props: { onClose: () => void }): React.ReactElement {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onClose]);
  return (
    <>
      <div className="ctx-backdrop" onClick={props.onClose} />
      <aside className="ctx-drawer" role="dialog" aria-modal="true" aria-label="Instructions">
        <div className="ctx-row-flex" style={{ justifyContent: 'space-between' }}>
          <h2>How to report travel expenses</h2>
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
