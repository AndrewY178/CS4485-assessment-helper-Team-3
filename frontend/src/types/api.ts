

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
  role: Role | null // first role the person holds (null if none), have frontend ignore this
  roles: Role[] // all roles the person holds 
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
  username: string
  prof_rank: string // this is hireLevel
  department: string
  last_sem_observed: string | null
  hiring_sem: string | null
  is_ac_member: boolean
  // might need to put course in a seperate response or an extension of this one
  // course: string
  //hireLevel: string
  // can be inferred by prof_rank
  // cycle: string
  // might want to put this in a different response
  // evaluationStatus: EvaluationStatus
}

// GET /api/users/{id}
// Used by: teacher detail. For a teacher, this is their own info.
// PROPOSED: same shape as UserResponse, plus email
export interface UserDetailResponse extends UserResponse {
  email: string
}

export interface ObserveeResponse extends UserDetailResponse {
  signup_sem: string
  course_id: string | null
  course_department: string | null
  course_number: string | null
  section_number: string | null
  course_name: string | null
  course_day: string | null
  course_start_time: string | null
  course_end_time: string | null
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

// ---------- Observer selection ----------

export type ObserverSelectionStatus =
  | 'not-generated'
  | 'pending-review'
  | 'approved'
  | 'invitations-sent'
  | 'no-eligible-observers'

export type ObserverEligibilityStatus = 'eligible' | 'unavailable'

export interface ObserverCandidateResponse {
  facultyId: string
  name: string
  department: string
  relevantCourseLevel: string
  currentObservationCount: number
  remainingCapacity: number
  scheduleCompatibility: string
  eligibilityStatus: ObserverEligibilityStatus
  matchingReasons: string[]
}

// PROPOSED: GET /api/observer-selection?semesterId={semesterId}
// One entry per faculty member who signed up. The backend must return no more
// than five candidates and enforce eligibility, schedule, and capacity rules.
export interface ObserverSelectionResponse {
  observationId: string
  semesterId: string
  observee: {
    facultyId: string
    name: string
    department: string
  }
  course: {
    code: string
    section: string
    title: string
    meetingDays: string[]
    startTime: string
    endTime: string
  }
  status: ObserverSelectionStatus
  recommendations: ObserverCandidateResponse[]
  selectedCandidateIds: string[]
  warning?: string
}

// PROPOSED: POST /api/observer-selection/run
export interface RunObserverSelectionRequest {
  semesterId: string
  observationId?: string
}

// PROPOSED: PUT /api/observer-selection/{observationId}/approval
// The backend must reject empty lists, lists over five, and ineligible IDs.
export interface ApproveObserverCandidatesRequest {
  candidateIds: string[]
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
