import { useEffect, useState, type FormEvent } from 'react'
import {
  dismissNotification,
  getNotificationRecipients,
  getNotifications,
  sendNotification,
  type NotificationMessage,
  type NotificationRecipient,
} from '../api/notifications'
import { useAuth } from '../context/AuthContext'
import '../styles/notifications.css'

const MAX_TITLE_LENGTH = 150
const MAX_MESSAGE_LENGTH = 5000

export default function NotificationsPage() {
  const { roles, token } = useAuth()
  const isAcMember = roles.includes('AC Member')
  const [notifications, setNotifications] = useState<NotificationMessage[]>([])
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [allFaculty, setAllFaculty] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [sending, setSending] = useState(false)
  const [dismissingId, setDismissingId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadPage() {
      if (!token) {
        setLoadError('Your session expired. Please log in again.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setLoadError('')
      try {
        const [inbox, faculty] = await Promise.all([
          getNotifications(token),
          isAcMember ? getNotificationRecipients(token) : Promise.resolve([]),
        ])
        if (!cancelled) {
          setNotifications(inbox)
          setRecipients(faculty)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to load notifications.',
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadPage()
    return () => {
      cancelled = true
    }
  }, [isAcMember, token])

  function toggleRecipient(userId: number) {
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    )
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setNotice('')
    if (!token) {
      setFormError('Your session expired. Please log in again.')
      return
    }
    if (!allFaculty && selectedIds.length === 0) {
      setFormError('Select at least one faculty recipient.')
      return
    }

    setSending(true)
    try {
      const result = await sendNotification(token, {
        title,
        message,
        allFaculty,
        userIds: allFaculty ? [] : selectedIds,
      })
      setNotice(
        `Message sent to ${result.recipientCount} faculty member${result.recipientCount === 1 ? '' : 's'}.`,
      )
      setTitle('')
      setMessage('')
      setSelectedIds([])
      setAllFaculty(false)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Unable to send the message.',
      )
    } finally {
      setSending(false)
    }
  }

  async function handleDismiss(notificationId: number) {
    if (!token) {
      setLoadError('Your session expired. Please log in again.')
      return
    }
    setDismissingId(notificationId)
    setLoadError('')
    try {
      await dismissNotification(token, notificationId)
      setNotifications((current) =>
        current.filter((notification) => notification.id !== notificationId),
      )
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to dismiss this notification.',
      )
    } finally {
      setDismissingId(null)
    }
  }

  return (
    <section className="screen-page notifications-page">
      <header className="screen-header">
        <div>
          <h1>Messages</h1>
          <p>Notifications sent to your Assessment Helper account.</p>
        </div>
      </header>

      {isAcMember && (
        <section
          aria-labelledby="compose-message-title"
          className="notification-compose"
        >
          <header className="notification-section-header">
            <h2 id="compose-message-title">Send a message</h2>
            <p>Send an in-app notification to selected faculty or all faculty.</p>
          </header>
          <form
            className="notification-form"
            onSubmit={(event) => void handleSend(event)}
          >
            <label className="notification-field">
              <span>Title</span>
              <input
                maxLength={MAX_TITLE_LENGTH}
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </label>
            <label className="notification-field">
              <span>Message</span>
              <textarea
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(event) => setMessage(event.target.value)}
                required
                rows={4}
                value={message}
              />
            </label>
            <label className="notification-all-faculty">
              <input
                checked={allFaculty}
                onChange={(event) => {
                  setAllFaculty(event.target.checked)
                  setSelectedIds([])
                }}
                type="checkbox"
              />
              <span>Send to all active faculty</span>
            </label>
            {!allFaculty && (
              <fieldset className="notification-recipient-list">
                <legend>Select faculty recipients</legend>
                {recipients.length === 0 ? (
                  <p>No active faculty accounts are available.</p>
                ) : (
                  recipients.map((recipient) => (
                    <label
                      className="notification-recipient"
                      key={recipient.user_id}
                    >
                      <input
                        checked={selectedIds.includes(recipient.user_id)}
                        onChange={() => toggleRecipient(recipient.user_id)}
                        type="checkbox"
                      />
                      <span>
                        {recipient.name} <small>{recipient.email}</small>
                      </span>
                    </label>
                  ))
                )}
              </fieldset>
            )}
            {formError && (
              <p className="notification-error" role="alert">
                {formError}
              </p>
            )}
            {notice && (
              <p className="notification-success" role="status">
                {notice}
              </p>
            )}
            <button
              className="button button--primary"
              disabled={sending || (!allFaculty && recipients.length === 0)}
              type="submit"
            >
              {sending ? 'Sending...' : 'Send message'}
            </button>
          </form>
        </section>
      )}

      <section aria-labelledby="inbox-title" className="notification-inbox">
        <header className="notification-section-header">
          <h2 id="inbox-title">Inbox</h2>
        </header>
        {loadError && (
          <p className="notification-error" role="alert">
            {loadError}
          </p>
        )}
        {isLoading ? (
          <p className="notification-empty">Loading messages...</p>
        ) : notifications.length === 0 ? (
          <p className="notification-empty">You have no new messages.</p>
        ) : (
          <div className="notification-list">
            {notifications.map((notification) => (
              <article className="notification-card" key={notification.id}>
                <header className="notification-card__header">
                  <div>
                    <h3>{notification.title}</h3>
                    <p>
                      From {notification.sender_name} ·{' '}
                      {notification.created_at}
                    </p>
                  </div>
                  <button
                    className="notification-dismiss"
                    disabled={dismissingId === notification.id}
                    onClick={() => void handleDismiss(notification.id)}
                    type="button"
                  >
                    {dismissingId === notification.id
                      ? 'Dismissing...'
                      : 'Dismiss'}
                  </button>
                </header>
                <p className="notification-card__message">
                  {notification.message}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
