

// ---------- Shared types ----------
export type EvaluationStatus = 'due' | 'overdue' | 'outstanding' | 'complete'
export type Role = 'AC Member' | 'Faculty'

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

// GET /api/schedule (all cycles) and PUT /api/schedule/{semId}
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
// Used by the AC dashboard stats and the cycle KPI report.
export interface CycleKpis {
  cycle: string
  due: number
  signedUp: number
  participationRate: number | null
  overdue: number
  unmatched: number
  eligibility: {
    eligible: number
    total: number
    rate: number | null
    sameProfessor: number
    otherDepartment: number
    differentLevel: number
    scheduleConflict: number
  }
  observerUtilization: {
    observed: number
    signedUp: number
    rate: number | null
  }
  listSufficiency: {
    matches: number
    signups: number
    average: number | null
  }
  missingObservations: number
  outstandingReports: number
  didNotGoThrough: number
  survey: {
    completed: number
    reachedSurvey: number
    rate: number | null
    surveysStored: boolean
  }
  byRank: Array<{
    rank: string
    due: number
    signedUp: number
    rate: number | null
  }>
}

export interface KpisResponse {
  cycles: CycleKpis[]
}

// GET /api/dashboard
export interface DashboardStep {
  title: string
  date: string | null
  subtitle: string | null
  status: 'done' | 'current' | 'upcoming'
}

export interface DashboardHireLevel {
  hireLevel: string
  cycle: string
  due: number
  overdue: number
  outstanding: number
}

export interface DashboardAlert {
  professorName: string
  course: string | null
  courseDay: string | null
  courseStartTime: string | null
  courseEndTime: string | null
}

export interface DashboardResponse {
  cycle: string | null
  steps: DashboardStep[]
  hireLevels: DashboardHireLevel[]
  alerts: DashboardAlert[]
}

// GET /api/users
// Used by: hireLevelRows (HireLevelTable), grouped by hireLevel on the frontend

export interface UserResponse {
  id: string
  name: string
  username: string
  prof_rank: string | null // this is hireLevel
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

// keep this updated with possible status column values from DB
// IMPORTANT: update SelectionStatusBadge.tsx and SelectionSummary.tsx when this gets updated
export type ObserveeStatus = 
  | 'not_generated'
  | 'generated'
  | 'no_observers'
  | 'approved'
  | 'invitations_sent'
  | 'manual'

// GET /api/cycles/deadline
export interface CycleDeadlineResponse {
  signup_deadline: string
  observation_deadline: string | null
  days_remaining: number
  is_past: boolean
}

export interface SaveCycleDeadlineRequest {
  semester: string
  signup_deadline: string
  observation_deadline: string
}

export interface FacultyCourse {
  course_id: number
  department: string
  course_number: string
  section_number: string
  course_name: string
  semester: string
  course_day: string | null
  course_start_time: string | null
  course_end_time: string | null
  room_number: string | null
}

// GET /api/observees/no-observers
export interface NoObserverObservee {
  observee_id: number
  signup_sem: string
  signup_course: number | null
  status: string
}

// GET /api/observees/uncompleted
export interface UncompletedObservee {
  observee_id: number
  signup_sem: string
  meeting_date: string | null
  uncompleted: boolean
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
  status: ObserveeStatus
}

// POST/PUT /api/users/{id}
// PROPOSED request: partial UserResponse fields
export type UserUpdateRequest = Partial<Omit<UserResponse, 'id'>>

// PUT /api/users/{id}/rank
export interface UpdateProfessorRankRequest {
  prof_rank: string
}

export interface UpdateProfessorRankResponse {
  id: number
  prof_rank: string
}

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

// export type ObserverSelectionStatus =
//   | 'not-generated'
//   | 'pending-review'
//   | 'approved'
//   | 'invitations-sent'
//   | 'no-eligible-observers'

export type ObserverEligibilityStatus = 'eligible' | 'unavailable'

// used for returning Observerlist when using GET /api/observers?observee_id=X&signup_sem=X
export interface ObserverCandidateResponse {
  observer_id: string
  professor_name: string
  professor_department: string
  currentObservationCount: number
  status?: string | null
  selected_date?: string | null
  teaches?: string | null
}

export interface ConfirmObserverResponse {
  observer_id: number
  status: 'confirmed'
  selected_date: string | null
  notifiedCount?: number
  emailError?: string | null
}

export interface SendObserverRequestsResponse {
  sent: Array<{
    observer_id: number
    professor_name: string | null
    notified: boolean
  }>
  skipped: number[]
  emailError: string | null
}

// GET /api/observer-requests
export interface ObserverRequestResponse {
  meeting_id: number
  observee_id: number
  observee_name: string | null
  signup_semester: string | null
  course_department: string | null
  course_number: string | null
  section_number: string | null
  course_name: string | null
  course_day: string | null
  course_start_time: string | null
  course_end_time: string | null
  room_number: string | null
  offered_dates: string[]
  selected_date: string | null
  status: 'pending' | 'accepted' | 'confirmed'
  minutes_left: number | null
}

// GET /api/observers/accepted?observee_id=&signup_semester=
export interface AcceptedObserverResponse {
  observer_id: number
  professor_name: string | null
  professor_department: string | null
  selected_date: string | null
}

// PROPOSED: GET /api/observer-selection?semesterId={semesterId}
// One entry per faculty member who signed up. The backend must return no more
// than five candidates and enforce eligibility, schedule, and capacity rules.
export interface ObserverSelectionResponse {
  observationId: string
  semesterId: string
  observee: ObserveeResponse
  course: {
    code: string
    section: string
    title: string
    meetingDays: string[]
    startTime: string
    endTime: string
  }
  status: ObserveeStatus
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

export interface GenerateObserverListsResponse {
  signup_semester: string
  total_observees: number
  generated: number
  failed: number
  lists: Array<{
    observee_id: number
    observer_count: number
  }>
  failures: Array<{
    observee_id: number
    error: string
  }>
}

// ---------- Teacher (Observee + Observer) ----------

// GET /api/my-observations
// Past observations for the logged-in faculty member, as observee or observer.
export interface PastObservation {
  meetingId: number
  meetingDate: string | null
  observeeId: number
  observeeName: string
  observerId: number | null
  observerName: string | null
  courseCode: string | null
  courseName: string | null
  semester: string | null
  reportExists: boolean
  content_clarity: number | null
  student_engagement: number | null
  openness_to_questions: number | null
  overall_comments: string | null
  tech_use: number | null
  slide_readability: number | null
  lecture_pace: number | null
}

export interface PastObservationsResponse {
  observations: PastObservation[]
}

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

// PUT /api/feedback
// GET /api/feedback?semester=&observee_id=
// GET /api/feedback/breakdown?semester=
export type FeedbackSemesterRole = 'observee' | 'observer' | 'both'
export type FeedbackProcessRating = 'yes' | 'mostly' | 'no'

export interface SaveFeedbackRequest {
  semester: string
  semester_role?: FeedbackSemesterRole
  process_OK: FeedbackProcessRating
  difficulties?: string | null
  improvements?: string | null
}

export interface FeedbackResponse {
  semester: string
  observee_id: number
  semester_role: FeedbackSemesterRole
  process_OK: FeedbackProcessRating
  difficulties: string | null
  improvements: string | null
}

export interface FeedbackBreakdownResponse {
  semester: string
  counts: {
    yes: number
    mostly: number
    no: number
  }
}

// POST /api/obs/{id}/form
// Observer: can edit the form and sign. Observee: can only sign.
// PROPOSED request: { answers: Record<string, number | string>, signed: boolean }
export interface EvaluationFormRequest {
  answers: Record<string, number | string>
  signed: boolean
}
