import { useState } from 'react'

type RequestStatus =
  | 'Confirmed - Nov 5'
  | 'Pending - 31h left'
  | 'Pending - 48h left'
  | 'Declined'
  | 'Not requested'

interface ObserverRequest {
  name: string
  course: string
  status: RequestStatus
}

const initialObservers: ObserverRequest[] = [
  { name: 'Dr. L. Ortiz', course: 'CS 1336 - free MW 8:30', status: 'Confirmed - Nov 5' },
  { name: 'Dr. J. Park', course: 'CS 1337 - free MW 8:30', status: 'Pending - 31h left' },
  { name: 'Dr. S. Nguyen', course: 'CS 1200 - free MW 8:30', status: 'Declined' },
  { name: 'Dr. A. Brooks', course: 'CS 1325 - free MW 8:30', status: 'Not requested' },
  { name: 'Dr. K. Iyer', course: 'CS 1337 - free MW 8:30', status: 'Not requested' },
]

export default function MyObserversPage() {
  const [observers, setObservers] = useState<ObserverRequest[]>(initialObservers)
  const [selected, setSelected] = useState<string[]>(['Dr. L. Ortiz', 'Dr. J. Park', 'Dr. S. Nguyen'])
  const [notice, setNotice] = useState('')
  const [accepted, setAccepted] = useState(false)

  function toggleObserver(name: string) {
    setSelected((current) =>
      current.includes(name)
        ? current.filter((observer) => observer !== name)
        : [...current, name],
    )
  }

  function sendRequests() {
    const requestable = observers.filter(
      (observer) => selected.includes(observer.name) && observer.status === 'Not requested',
    )
    if (requestable.length === 0) {
      setNotice('Select at least one observer who has not already been requested.')
      return
    }
    setObservers((current) =>
      current.map((observer) =>
        requestable.some((request) => request.name === observer.name)
          ? { ...observer, status: 'Pending - 48h left' }
          : observer,
      ),
    )
    setNotice(`Request sent to ${requestable.map(({ name }) => name).join(', ')}.`)
  }

  function acceptObserver() {
    setAccepted(true)
    setObservers((current) =>
      current.map((observer) =>
        observer.name !== 'Dr. L. Ortiz' &&
        observer.status !== 'Not requested'
          ? { ...observer, status: 'Declined' }
          : observer,
      ),
    )
  }

  return (
    <section className="screen-page participant-page observers-page">
      <header className="participant-header">
        <div>
          <p className="participant-course">CS 1337.002 - MW 8:30-9:45 AM</p>
          <h1>Your observer list is ready</h1>
          <p>Send a request to one or more observers. Requests expire after 48 hours.</p>
        </div>
      </header>

      {observers.some(({ status }) => status.startsWith('Confirmed')) && (
        <section aria-label="Confirmed observer" className="confirmed-observer-banner">
          <div>
            <strong>{accepted ? 'Dr. L. Ortiz is your selected observer' : 'Dr. L. Ortiz confirmed Wed, Nov 5'}</strong>
            <p>{accepted ? 'Your observation is set for Wed, Nov 5.' : 'Accept to lock in this observer. Your other requests get a polite decline automatically.'}</p>
          </div>
          {!accepted && (
            <button className="button button--primary" onClick={acceptObserver} type="button">
              Accept
            </button>
          )}
        </section>
      )}

      {notice && <p className="inline-notice" role="status">{notice}</p>}

      <div className="observer-list-scroll">
        <table className="screen-table observer-list-table">
          <thead>
            <tr>
              <th scope="col"><span className="visually-hidden">Select</span></th>
              <th scope="col">Observer</th>
              <th scope="col">Teaches</th>
              <th scope="col">Request status</th>
            </tr>
          </thead>
          <tbody>
            {observers.map((observer) => (
              <tr key={observer.name}>
                <td>
                  <input
                    aria-label={`Select ${observer.name}`}
                    checked={selected.includes(observer.name)}
                    onChange={() => toggleObserver(observer.name)}
                    type="checkbox"
                  />
                </td>
                <td>{observer.name}</td>
                <td>{observer.course}</td>
                <td className={observer.status.startsWith('Confirmed') ? 'observer-status--confirmed' : undefined}>
                  {observer.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="observer-list-actions">
        <p>Requests include your dates: Nov 3, Nov 5, Nov 10</p>
        <button className="button button--outline" onClick={sendRequests} type="button">
          Send request to selected
        </button>
      </footer>

      <p className="observer-list-help">Nobody confirmed? <a href="mailto:assessment@utdallas.edu">Let the Assessment Committee know</a></p>
    </section>
  )
}
