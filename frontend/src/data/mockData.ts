export type StepStatus = 'done' | 'current' | 'upcoming'

export interface CycleStep {
  title: string
  date?: string
  subtitle?: string
  status: StepStatus
}

export const cycleSteps: CycleStep[] = [
  { title: 'Sign-up deadline', date: 'Oct 24', status: 'done' },
  {
    title: 'Observer selection',
    subtitle: 'Run after sign-up closes',
    status: 'current',
  },
  { title: 'Observation deadline', date: 'Nov 21', status: 'upcoming' },
  { title: 'Survey deadline', date: 'Dec 5', status: 'upcoming' },
]

export interface Stat {
  label: string
  value: string
  caption: string
  warning?: boolean
}

export const stats: Stat[] = [
  {
    label: 'Due this semester',
    value: '18',
    caption: 'In the current observation cycle',
  },
  { label: 'Overdue', value: '6', caption: 'From a previous cycle' },
  {
    label: 'Signed up',
    value: '14 of 24',
    caption: '10 faculty still to sign up',
  },
  {
    label: 'Unmatched faculty',
    value: '2',
    caption: 'Observer assignment needed',
    warning: true,
  },
]

export interface HireLevelRow {
  hireLevel: string
  cycle: string
  due: number
  overdue: number
  outstanding: number
}

export const hireLevelRows: HireLevelRow[] = [
  {
    hireLevel: 'Professor',
    cycle: 'Every year',
    due: 8,
    overdue: 3,
    outstanding: 5,
  },
  {
    hireLevel: 'Professor',
    cycle: 'Every year',
    due: 6,
    overdue: 2,
    outstanding: 4,
  },
  {
    hireLevel: 'Professor',
    cycle: 'Every year',
    due: 4,
    overdue: 1,
    outstanding: 2,
  },
  {
    hireLevel: 'Professor',
    cycle: 'Every year',
    due: 3,
    overdue: 2,
    outstanding: 2,
  },
  {
    hireLevel: 'Professor',
    cycle: 'Every year',
    due: 4,
    overdue: 1,
    outstanding: 2,
  },
]
