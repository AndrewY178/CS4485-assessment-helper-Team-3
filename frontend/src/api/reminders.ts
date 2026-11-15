import { post } from './client'

export interface ReminderResult {
  sentCount: number
  recipientCount: number
  notificationCount: number
  testMode: boolean
}

export function sendSignUpReminders(token: string) {
  return post<ReminderResult>('/api/reminders', {token})
}
