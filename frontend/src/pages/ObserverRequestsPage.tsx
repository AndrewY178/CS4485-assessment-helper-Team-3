import { useState } from 'react'

interface ObservationRequest {
  id: number
  name: string
  course: string
  schedule: string
  expires: string
  dates: string[]
  selectedDate: string
  status: 'pending' | 'confirmed' | 'declined'
  confirmedText?: string
}

const initialRequests: ObservationRequest[] = [
  {
    id: 1,
    name: 'Dr. Daniel Ruiz',
    course: 'CS 3345.001',
    schedule: 'TR 1:00-2:15 PM - ECSS 2.312',
    expires: '3h',
    dates: ['Tue, Nov 4', 'Thu, Nov 6'],
    selectedDate: 'Tue, Nov 4',
    status: 'pending',
  },
  {
    id: 2,
    name: 'Dr. Sam Okafor',
    course: 'CS 3354.002',
    schedule: 'TR 2:30-3:45 PM - JSOM 1.217',
    expires: '5h',
    dates: ['Thu, Oct 28', 'Thu, Oct 30', 'Thu, Nov 11'],
    selectedDate: '',
    status: 'pending',
  },
  {
    id: 3,
    name: 'Dr. Sally Conrad',
    course: 'CS 1337.002',
    schedule: '',
    expires: '',
    dates: [],
    selectedDate: '',
    status: 'confirmed',
    confirmedText: 'You confirmed Wed, Nov 5 - she accepted',
  },
]

export default function ObserverRequestsPage() {
  const [requests, setRequests] = useState(initialRequests)
  const [notice, setNotice] = useState('')

  function chooseDate(id: number, date: string) {
    setRequests((current) =>
      current.map((request) => request.id === id ? { ...request, selectedDate: date } : request),
    )
  }

  function respond(id: number, status: 'confirmed' | 'declined') {
    const request = requests.find((item) => item.id === id)
    if (!request) return
    if (status === 'confirmed' && !request.selectedDate) {
      setNotice('Choose a date before confirming this request.')
      return
    }
    setRequests((current) =>
      current.map((item) => item.id === id
        ? { ...item, status, confirmedText: status === 'confirmed' ? `You confirmed ${item.selectedDate}` : 'You declined this request' }
        : item),
    )
    setNotice(status === 'confirmed' ? `You confirmed ${request.name}'s request.` : `You declined ${request.name}'s request.`)
  }

  const visibleRequests = requests.filter((request) => request.status !== 'declined')

  return (
    <section className="screen-page participant-page requests-page">
      <header className="participant-header">
        <div>
          <h1>Observation requests</h1>
          <p>Respond within 48 hours. You can confirm up to 3.</p>
        </div>
      </header>

      {notice && <p className="inline-notice" role="status">{notice}</p>}

      <div className="request-cards">
        {visibleRequests.map((request) => (
          <article className={`request-card${request.status === 'confirmed' ? ' request-card--confirmed' : ''}`} key={request.id}>
            {request.status === 'pending' ? (
              <>
                <div className="request-card__heading">
                  <div>
                    <h2>{request.name} - {request.course}</h2>
                    <p>{request.schedule}</p>
                  </div>
                  <span className="request-expiration">Expires in {request.expires}</span>
                </div>
                <fieldset className="request-date-picker">
                  <legend>Pick a date</legend>
                  <div className="request-date-options">
                    {request.dates.map((date) => (
                      <label className={`date-option${request.selectedDate === date ? ' date-option--selected' : ''}`} key={date}>
                        <input
                          checked={request.selectedDate === date}
                          name={`request-date-${request.id}`}
                          onChange={() => chooseDate(request.id, date)}
                          type="radio"
                          value={date}
                        />
                        {date}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="request-card__actions">
                  <button className="button button--outline" onClick={() => respond(request.id, 'declined')} type="button">Decline</button>
                  <button className="button button--primary" onClick={() => respond(request.id, 'confirmed')} type="button">Confirm</button>
                </div>
              </>
            ) : (
              <div className="request-card__confirmed-content">
                <div>
                  <h2>{request.name} - {request.course}</h2>
                  <p>{request.confirmedText}</p>
                </div>
                <a className="text-link" href="/my-schedule">View in my schedule</a>
              </div>
            )}
          </article>
        ))}
        {visibleRequests.length === 0 && (
          <p className="empty-requests">You&apos;re all caught up. New observation requests will appear here.</p>
        )}
      </div>
    </section>
  )
}
