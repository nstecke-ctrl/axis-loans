import { useContext } from 'react'
import { AppRoleContext } from './appRoleCore'

export function useAppRole() {
  const context = useContext(AppRoleContext)

  if (!context) {
    throw new Error('useAppRole must be used inside AppRoleProvider.')
  }

  return context
}
