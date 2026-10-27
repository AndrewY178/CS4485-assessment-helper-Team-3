interface DeadlineFieldProps {
  disabled?: boolean
  error?: string
  helperText: string
  id: string
  label: string
  onChange: (value: string) => void
  value: string
}

const hourOptions = Array.from({ length: 12 }, (_, index) => String(index + 1))
const minuteOptions = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'))

function getDeadlineParts(value: string) {
  const [date = '', time = '00:00'] = value.split('T')
  const [hourText = '00', minute = '00'] = time.split(':')
  const hour24 = Number(hourText)

  if (hour24 === 0) return { date, hour: '12', minute, period: 'AM' as const }
  if (hour24 < 12) return { date, hour: String(hour24), minute, period: 'AM' as const }
  if (hour24 === 12) return { date, hour: '12', minute, period: 'PM' as const }
  return { date, hour: String(hour24 - 12), minute, period: 'PM' as const }
}

function combineDeadline(
  date: string,
  hour: string,
  minute: string,
  period: 'AM' | 'PM',
) {
  if (!date) return ''

  const hourNumber = Number(hour)
  let hour24 = hourNumber

  if (period === 'AM' && hourNumber === 12) hour24 = 0
  if (period === 'PM') hour24 = hourNumber === 12 ? 12 : hourNumber + 12

  return `${date}T${String(hour24).padStart(2, '0')}:${minute}`
}

export default function DeadlineField({
  disabled = false,
  error,
  helperText,
  id,
  label,
  onChange,
  value,
}: DeadlineFieldProps) {
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`
  const parts = getDeadlineParts(value)

  function updatePart(next: Partial<typeof parts>) {
    const updated = { ...parts, ...next }
    onChange(combineDeadline(updated.date, updated.hour, updated.minute, updated.period))
  }

  return (
    <div className="cycle-field">
      <label htmlFor={id}>{label}</label>
      <div
        aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}
        className="cycle-field__datetime"
      >
        <input
          aria-invalid={Boolean(error)}
          disabled={disabled}
          id={id}
          onChange={(event) => updatePart({ date: event.target.value })}
          type="date"
          value={parts.date}
        />
        <select
          aria-label={`${label} hour`}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          id={`${id}-hour`}
          onChange={(event) => updatePart({ hour: event.target.value })}
          value={parts.hour}
        >
          {hourOptions.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
        </select>
        <span aria-hidden="true" className="cycle-field__time-separator">:</span>
        <select
          aria-label={`${label} minute`}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          id={`${id}-minute`}
          onChange={(event) => updatePart({ minute: event.target.value })}
          value={parts.minute}
        >
          {minuteOptions.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
        </select>
        <select
          aria-label={`${label} AM or PM`}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          id={`${id}-period`}
          onChange={(event) => updatePart({ period: event.target.value as 'AM' | 'PM' })}
          value={parts.period}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      <span className="cycle-field__helper" id={descriptionId}>{helperText}</span>
      {error && <span className="cycle-field__error" id={errorId} role="alert">{error}</span>}
    </div>
  )
}
