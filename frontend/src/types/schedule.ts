export interface FacultyScheduleCourse {
  code: string
  title?: string | null
}

export interface FacultyScheduleObservation {
  id: string
  observationDate: string
  course: FacultyScheduleCourse
  counterpartName: string
  status?: string | null
}

export interface FacultyScheduleResponse {
  conducting: FacultyScheduleObservation[]
  scheduledForMe: FacultyScheduleObservation[]
}
