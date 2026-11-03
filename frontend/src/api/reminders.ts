import emailjs from '@emailjs/browser'
import { getSignUpRequests } from './signups'

const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID?.trim()
const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID?.trim()
const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY?.trim()
const testRecipient = import.meta.env.VITE_EMAILJS_TEST_RECIPIENT?.trim()

interface ReminderResult {
  sentCount: number
  recipientCount: number
  testMode: boolean
}

function getEmailJsConfig() {
  if (!serviceId || !templateId || !publicKey) {
    throw new Error(
      'EmailJS is not configured. Add the service ID, template ID, and public key to the repository-root .env file, then restart the frontend.',
    )
  }

  return { serviceId, templateId, publicKey }
}

function templateParams(
  toEmail: string,
  toName: string,
  message: string,
) {
  return {
    to_email: toEmail,
    to_name: toName,
    message,
  }
}

function reminderMessage(status: string) {
  return `This is an automated reminder from Assessment Helper regarding your faculty evaluation and observation process. Your sign-up is currently ${status.toLowerCase()}.

Please log in to Assessment Helper to review any pending actions or updates.

If you believe you received this email by mistake, please contact your Assessment Committee.`
}

export async function sendSignUpReminders(): Promise<ReminderResult> {
  const config = getEmailJsConfig()

  const signUpRequests = await getSignUpRequests()
  const recipients = signUpRequests.filter(
    (request) => request.status === 'Due' || request.status === 'Overdue',
  )

  if (recipients.length === 0) {
    throw new Error('There are no due or overdue sign-up reminders to send.')
  }

  if (import.meta.env.DEV) {
    if (!testRecipient) {
      throw new Error(
        'Development email sending is disabled until VITE_EMAILJS_TEST_RECIPIENT is set in frontend/.env.local.',
      )
    }

    const recipientSummary = recipients
      .map((recipient) => `${recipient.name} (${recipient.status})`)
      .join('\n')
    const message = `Test message only. In production, the following reminders would be sent individually:\n\n${recipientSummary}\n\n${reminderMessage('due or overdue')}`

    await emailjs.send(
      config.serviceId,
      config.templateId,
      templateParams(testRecipient, 'Assessment Helper test inbox', message),
      config.publicKey,
    )

    return {
      sentCount: 1,
      recipientCount: recipients.length,
      testMode: true,
    }
  }

  let sentCount = 0
  for (const recipient of recipients) {
    try {
      await emailjs.send(
        config.serviceId,
        config.templateId,
        templateParams(
          recipient.email,
          recipient.name,
          reminderMessage(recipient.status),
        ),
        config.publicKey,
      )
      sentCount += 1
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'EmailJS request failed.'
      throw new Error(
        `${sentCount} of ${recipients.length} reminders were sent. Sending to ${recipient.email} failed: ${reason}`,
        { cause: error },
      )
    }
  }

  return {
    sentCount,
    recipientCount: recipients.length,
    testMode: false,
  }
}
