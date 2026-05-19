import { supabase } from '../../../lib/supabase'

export type DashboardLoanSummary = {
  code: string
  company: string
  responsible: string
  expectedReturnDate: string
  status: 'Active' | 'Overdue' | 'Due Soon' | 'Returned' | 'Cancelled'
  overdueDelay?: string
}

type DashboardLoanRow = {
  code: string
  company: string
  responsible: string
  expected_return_date: string
  status: 'Active' | 'Overdue' | 'Due Soon' | 'Returned' | 'Cancelled'
}

function formatDatabaseDate(value: string) {
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function calculateOverdueDelay(expectedReturnDate: string) {
  const dueDate = new Date(`${expectedReturnDate}T00:00:00`)
  const today = new Date()

  today.setHours(0, 0, 0, 0)
  dueDate.setHours(0, 0, 0, 0)

  const differenceInDays = Math.max(
    0,
    Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    ),
  )

  if (differenceInDays === 1) {
    return '1 day overdue'
  }

  return `${differenceInDays} days overdue`
}

export async function fetchDashboardLoansFromSupabase() {
  const { data, error } = await supabase
    .from('loans')
    .select(
      `
        code,
        company,
        responsible,
        expected_return_date,
        status
      `,
    )
    .order('expected_return_date', { ascending: true })

  if (error) {
    throw new Error(`Unable to load dashboard loans: ${error.message}`)
  }

  const loans = (data ?? []) as DashboardLoanRow[]

  const overdueLoans: DashboardLoanSummary[] = loans
    .filter((loan) => loan.status === 'Overdue')
    .map((loan) => ({
      code: loan.code,
      company: loan.company,
      responsible: loan.responsible,
      expectedReturnDate: formatDatabaseDate(loan.expected_return_date),
      status: loan.status,
      overdueDelay: calculateOverdueDelay(loan.expected_return_date),
    }))

  const upcomingReturns: DashboardLoanSummary[] = loans
    .filter((loan) => loan.status === 'Due Soon')
    .map((loan) => ({
      code: loan.code,
      company: loan.company,
      responsible: loan.responsible,
      expectedReturnDate: formatDatabaseDate(loan.expected_return_date),
      status: loan.status,
    }))

  return {
    overdueLoans,
    upcomingReturns,
  }
}