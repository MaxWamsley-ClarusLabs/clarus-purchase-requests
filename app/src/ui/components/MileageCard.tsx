import * as React from 'react';
import { TEXT_MAX_LENGTH } from '../../domain/lists';
import { mileageAmountCents, parseMiles, rateText, tripLabel } from '../../domain/mileage';
import { formatCents } from '../../domain/money';
import { MILEAGE_CENTS_PER_MILE, rateFor } from '../../domain/rates';
import { MileageTrip } from '../../domain/types';
import { Issue, MileageField } from '../../domain/validation';
import { todayIso } from '../../domain/dates';
import { Card } from './common';
import { Icon } from './Icon';

let tripCounter = 0;
function newTripId(): string {
  tripCounter += 1;
  return `trip-${Date.now()}-${tripCounter}`;
}

/**
 * Drives in the employee's own car (D-071), shown on the Expenses step while
 * "I drove my own car" is on. Each drive is paid at the GSA rate for its date.
 */
export function MileageCard(props: { trips: MileageTrip[]; issues: Issue[]; editable: boolean; onChange: (trips: MileageTrip[]) => void }): React.ReactElement {
  const { trips, issues, editable } = props;
  // What was typed in each miles box, so "12." can be typed on the way to "12.5".
  const [milesText, setMilesText] = React.useState<Record<string, string>>({});
  const update = (id: string, changes: Partial<MileageTrip>) => props.onChange(trips.map((t) => (t.id === id ? { ...t, ...changes } : t)));
  const issueFor = (trip: MileageTrip, field: MileageField) => {
    const found = issues.filter((i) => i.tripId === trip.id && i.field === field);
    return found.find((i) => i.severity === 'blocking') ?? found[0];
  };
  const cell = (trip: MileageTrip, field: MileageField, extra = '') => `ctx-cell ${extra} ${issueFor(trip, field)?.severity ?? ''}`;
  const today = rateFor(MILEAGE_CENTS_PER_MILE, todayIso());

  return (
    <Card title={`Mileage (${trips.length})`} actions={<span className="ctx-hint">{today ? `GSA rate: ${rateText(today.value)}` : ''}</span>}>
      {trips.length === 0 ? (
        <div className="ctx-empty">
          <Icon name="plus" size={28} />
          <h3>No drives yet</h3>
          Add each drive in your own car: date, from, to and miles. A round trip is one drive with the total miles.
        </div>
      ) : (
        <div className="ctx-grid-wrap">
          <table className="ctx-grid ctx-mileage">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th style={{ width: 150 }}>Date</th>
                <th>From</th>
                <th>To</th>
                <th style={{ width: 100 }}>Miles</th>
                <th style={{ width: 110 }} className="num">
                  Amount
                </th>
                {editable ? <th style={{ width: 44 }} /> : null}
              </tr>
            </thead>
            <tbody>
              {trips.map((trip, index) => {
                const cents = mileageAmountCents(trip);
                return (
                  <tr key={trip.id}>
                    <td className="ctx-strong">{tripLabel(index)}</td>
                    <td>
                      <input
                        type="date"
                        className={cell(trip, 'date')}
                        title={issueFor(trip, 'date')?.message}
                        aria-label={`Mileage ${tripLabel(index)} date`}
                        value={trip.date}
                        disabled={!editable}
                        onChange={(e) => update(trip.id, { date: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className={cell(trip, 'from')}
                        title={issueFor(trip, 'from')?.message}
                        aria-label={`Mileage ${tripLabel(index)} from`}
                        placeholder="For example: Office"
                        maxLength={TEXT_MAX_LENGTH}
                        value={trip.from}
                        disabled={!editable}
                        onChange={(e) => update(trip.id, { from: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className={cell(trip, 'to')}
                        title={issueFor(trip, 'to')?.message}
                        aria-label={`Mileage ${tripLabel(index)} to`}
                        placeholder="For example: Airport"
                        maxLength={TEXT_MAX_LENGTH}
                        value={trip.to}
                        disabled={!editable}
                        onChange={(e) => update(trip.id, { to: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className={cell(trip, 'miles', 'amount')}
                        title={issueFor(trip, 'miles')?.message}
                        aria-label={`Mileage ${tripLabel(index)} miles`}
                        inputMode="decimal"
                        value={milesText[trip.id] ?? (trip.miles === null ? '' : String(trip.miles))}
                        disabled={!editable}
                        onChange={(e) => {
                          const text = e.target.value;
                          setMilesText((m) => ({ ...m, [trip.id]: text }));
                          update(trip.id, { miles: parseMiles(text) });
                        }}
                      />
                    </td>
                    <td className="num">{cents === null ? '' : formatCents(cents)}</td>
                    {editable ? (
                      <td>
                        <button
                          className="ctx-btn ctx-btn-ghost ctx-btn-small"
                          aria-label={`Remove drive ${tripLabel(index)}`}
                          title="Remove this drive"
                          onClick={() => props.onChange(trips.filter((t) => t.id !== trip.id))}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editable ? (
        <div className="ctx-grid-footer">
          <button
            className="ctx-btn ctx-btn-secondary ctx-btn-small"
            onClick={() => props.onChange([...trips, { id: newTripId(), date: '', from: '', to: '', miles: null }])}
          >
            <Icon name="plus" size={15} />
            Add a drive
          </button>
          <span className="ctx-hint">Paid at the GSA rate for each date. No receipt is needed. Driving between home and your usual workplace is not paid.</span>
        </div>
      ) : null}
    </Card>
  );
}
