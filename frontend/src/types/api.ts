

// ---------- Shared types ----------
export type EvaluationStatus = 'due' | 'overdue' | 'outstanding' | 'complete'
export type Role = 'AC Member' | 'Observee' | 'Observer'

// ---------- General / Auth ----------

// POST /api/auth/login
// Used by: LoginPage, AuthContext
// PROPOSED request: { email, password }
// PROPOSED response: { token, role, userId }
export interface LoginRequest {
  email: string
  password: string
}
export interface LoginResponse {
  token: string
  role: Role
  userId: string
}

// POST /api/auth/logout
// Used by: Sidebar "Log out"
// PROPOSED response: 204 No Content
export type LogoutResponse = void

// POST /api/auth/forgot-password
// PROPOSED request: { email }   PROPOSED response: { message }
// Not in Figma yet
export interface ForgotPasswordRequest {
  email: string
}

// POST /api/auth/reset-password
// PROPOSED request: { token, newPassword }   PROPOSED response: { message }
// Not in Figma yet
export interface ResetPasswordRequest {
  token: string
  newPassword: string
}

// POST /api/auth/change-password
// PROPOSED request: { currentPassword, newPassword }   PROPOSED response: { message }
// Not in Figma yet
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// ---------- AC Member ----------

export type CycleStatus =
  | 'draft'
  | 'signup'
  | 'observation'
  | 'feedback'
  | 'closed'

// GET /api/schedule/{semId}
// Timestamps are UTC ISO 8601 strings. Display them in the response timezone.
export interface EvaluationCycleResponse {
  id: string
  semesterId: string
  semesterLabel: string
  timezone: 'America/Chicago'
  status: CycleStatus
  signupDeadline: string
  observationDeadline: string
  feedbackDeadline: string
  updatedAt: string
}

// POST/PUT /api/schedule/{semId}
export interface SaveEvaluationCycleRequest {
  signupDeadline: string
  observationDeadline: string
  feedbackDeadline: string
}

export interface ApiFieldError {
  field: string
  message: string
}

export interface ApiErrorResponse {
  code: string
  message: string
  fieldErrors?: ApiFieldError[]
}

// GET /api/kpis
// Used by: stats (StatCard)
// Send numbers, not display strings. The frontend formats "14 of 24".
export interface KpisResponse {
  dueThisSemester: number
  overdue: number
  signedUp: number
  totalFaculty: number
  unmatchedFaculty: number
}

// GET /api/users
// Used by: hireLevelRows (HireLevelTable), grouped by hireLevel on the frontend
export interface UserResponse {
  id: string
  name: string
  course: string
  hireLevel: string
  cycle: string
  evaluationStatus: EvaluationStatus
}

// GET /api/users/{id}
// Used by: teacher detail. For a teacher, this is their own info.
// PROPOSED: same shape as UserResponse, plus email
export interface UserDetailResponse extends UserResponse {
  email: string
}

// POST/PUT /api/users/{id}
// PROPOSED request: partial UserResponse fields
export type UserUpdateRequest = Partial<Omit<UserResponse, 'id'>>

// GET /api/obs
// Used by: Observer Selection rows
// PROPOSED: one entry per observation
export interface ObservationResponse {
  id: string
  observeeId: string
  observerIds: string[]
  status: EvaluationStatus // PROPOSED: confirm observation status values
}

// GET /api/obs/{id}
// PROPOSED: same as ObservationResponse, plus form data when submitted
export interface ObservationDetailResponse extends ObservationResponse {
  form?: unknown // TODO: shape of the evaluation form
}

// POST/PUT /api/obs/{id}/observers
// Used by: Observer Selection (AC), accepting observers (teacher)
// PROPOSED request: { observerIds: string[] }
export interface SetObserversRequest {
  observerIds: string[]
}

// GET /api/template
// NO ENDPOINT YET: only POST/PUT exists. Needed to load the template page.
// POST/PUT /api/template
// Used by: TemplatePage
// PROPOSED request/response: { version, criteria: TemplateCriterion[] }
export interface TemplateCriterion {
  id: string
  name: string
  type: 'rating' | 'text' // PROPOSED
  weight: number
  required: boolean
}
export interface TemplateResponse {
  version: number
  criteria: TemplateCriterion[]
}

// ---------- Teacher (Observee + Observer) ----------

// GET /api/users/{id}/obs
// Used by: "Observations of me" and "Observations I give"
// PROPOSED: returns ObservationResponse[]
export type UserObservationsResponse = ObservationResponse[]

// GET /api/invitations
// Used by: "Observers assigned to me" / pending invitations
// PROPOSED response: array of pending invitations
export interface InvitationResponse {
  id: string
  observationId: string
  fromUserId: string
  status: 'pending' | 'accepted' | 'declined' // PROPOSED
}

// POST /api/invitations/{id}/accept
// PROPOSED response: { id, status: 'accepted' }
// POST /api/invitations/{id}/decline
// PROPOSED response: { id, status: 'declined' }

// PUT /api/obs/{id}/observers (teacher version)
// Updates the observer for a teacher after the observer accepts.
// Uses SetObserversRequest above.

// POST /api/feedback
// Used by: Survey
// PROPOSED request: { answers: Record<string, number | string> }
export interface FeedbackRequest {
  answers: Record<string, number | string>
}

// POST /api/obs/{id}/form
// Observer: can edit the form and sign. Observee: can only sign.
// PROPOSED request: { answers: Record<string, number | string>, signed: boolean }
export interface EvaluationFormRequest {
  answers: Record<string, number | string>
  signed: boolean
}
