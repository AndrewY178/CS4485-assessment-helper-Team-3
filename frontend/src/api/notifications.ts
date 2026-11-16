import { getAuthenticated, patch, postJson } from './client'

export interface NotificationMessage {
  id: number
  title: string
  message: string
  created_at: string
  sender_name: string
}

export interface NotificationRecipient {
  user_id: number
  name: string
  email: string
}

export interface SendNotificationRequest {
  title: string
  message: string
  allFaculty: boolean
  userIds: number[]
}

export function getNotifications(token: string) {
  return getAuthenticated<NotificationMessage[]>('/api/notifications', token)
}

export function getUnreadNotificationCount(token: string) {
  return getAuthenticated<{ unreadCount: number }>(
    '/api/notifications/unread-count',
    token,
  )
}

export function markNotificationsRead(token: string) {
  return patch<{ message: string }>('/api/notifications/read', token)
}

export function getNotificationRecipients(token: string) {
  return getAuthenticated<NotificationRecipient[]>(
    '/api/notifications/recipients',
    token,
  )
}

export function sendNotification(
  token: string,
  body: SendNotificationRequest,
) {
  return postJson<{ message: string; recipientCount: number }>(
    '/api/notifications',
    token,
    body,
  )
}

export function dismissNotification(token: string, notificationId: number) {
  return patch<{ message: string }>(
    `/api/notifications/${notificationId}/dismiss`,
    token,
  )
}
