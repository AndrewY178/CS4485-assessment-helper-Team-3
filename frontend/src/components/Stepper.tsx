import { cycleSteps } from '../data/mockData'
import { CheckIcon } from './Icons'

export default function Stepper() {
  return (
    <ol aria-label="Observation cycle progress" className="stepper">
      {cycleSteps.map((step, index) => (
        <li
          className={`stepper__step stepper__step--${step.status}`}
          key={step.title}
        >
          <div className="stepper__top">
            <span className="stepper__marker" aria-hidden="true">
              {step.status === 'done' ? (
                <CheckIcon className="stepper__check" />
              ) : (
                index + 1
              )}
            </span>
            {index < cycleSteps.length - 1 && (
              <span className="stepper__connector" aria-hidden="true" />
            )}
          </div>
          <div className="stepper__content">
            <div className="stepper__title">{step.title}</div>
            {step.date && <div className="stepper__date">{step.date}</div>}
            {step.subtitle && (
              <div className="stepper__subtitle">{step.subtitle}</div>
            )}
            {step.status === 'done' && (
              <span className="stepper__status stepper__status--done">
                Done
              </span>
            )}
            {step.status === 'current' && (
              <span className="stepper__badge">Current</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
