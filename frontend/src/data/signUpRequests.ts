export type SignUpStatus = 'Due' | 'Overdue'

export interface SignUpRequest {
  name: string
  email: string
  level: string
  course: string
  time: string
  status: SignUpStatus
}

export const signUpRequests: SignUpRequest[] = [
  { name: 'Dr. Priya Raman', email: 'p.raman@utdallas.edu', level: 'Professor', course: 'CS 1337.002', time: 'MW 8:30', status: 'Due' },
  { name: 'Dr. Daniel Ruiz', email: 'd.ruiz@utdallas.edu', level: 'Professor', course: 'CS 3345.001', time: 'TR 1:00', status: 'Due' },
  { name: 'Dr. Maya Chen', email: 'm.chen@utdallas.edu', level: 'Professor', course: 'CS 4349.003', time: 'TR 10:00', status: 'Overdue' },
  { name: 'Dr. Omar Haddad', email: 'o.haddad@utdallas.edu', level: 'Professor', course: 'CS 6360.501', time: 'MW 4:00', status: 'Overdue' },
  { name: 'Dr. Lena Fischer', email: 'l.fischer@utdallas.edu', level: 'Professor', course: 'CS 2340.004', time: 'MW 11:30', status: 'Due' },
  { name: 'Dr. Sam Okafor', email: 's.okafor@utdallas.edu', level: 'Professor', course: 'CS 3354.002', time: 'TR 2:30', status: 'Due' },
  { name: 'Dr. Kim Tran', email: 'k.tran@utdallas.edu', level: 'Professor', course: 'CS 3341.003', time: 'MW 2:30', status: 'Due' },
  { name: 'Dr. Ravi Menon', email: 'r.menon@utdallas.edu', level: 'Professor', course: 'CS 2336.004', time: 'MW 1:00', status: 'Overdue' },
  { name: 'Dr. Elena Petrova', email: 'e.petrova@utdallas.edu', level: 'Professor', course: 'CS 4341.001', time: 'TR 11:30', status: 'Due' },
  { name: 'Dr. Marcus Bell', email: 'm.bell@utdallas.edu', level: 'Professor', course: 'CS 4384.002', time: 'MW 10:00', status: 'Due' },
  { name: 'Dr. Aisha Patel', email: 'a.patel@utdallas.edu', level: 'Professor', course: 'CS 3377.001', time: 'TR 9:30', status: 'Overdue' },
  { name: 'Dr. Noah Williams', email: 'n.williams@utdallas.edu', level: 'Professor', course: 'CS 4390.003', time: 'MW 3:00', status: 'Due' },
  { name: 'Dr. Sofia Alvarez', email: 's.alvarez@utdallas.edu', level: 'Professor', course: 'CS 4485.001', time: 'TR 4:00', status: 'Due' },
  { name: 'Dr. Ethan Brooks', email: 'e.brooks@utdallas.edu', level: 'Professor', course: 'CS 4301.002', time: 'MW 12:00', status: 'Overdue' },
]
