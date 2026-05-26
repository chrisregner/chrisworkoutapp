import { NavLink } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconBarbell, IconDumbbell, IconHome } from '@tabler/icons-react'

const NAV_ITEMS = [
  { to: '/', label: 'Workout', icon: IconHome, exact: true },
  { to: '/exercises', label: 'Exercises', icon: IconDumbbell, exact: false },
  { to: '/equipments', label: 'Equipment', icon: IconBarbell, exact: false },
]

export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <Group
      component="nav"
      grow
      gap={0}
      style={{
        borderTop: '1px solid var(--mantine-color-default-border)',
        backgroundColor: 'var(--mantine-color-body)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {NAV_ITEMS.map(({ to, label, icon: Icon, exact }) => {
        const active = exact ? pathname === to : pathname.startsWith(to)
        return (
          <UnstyledButton
            key={to}
            component={NavLink}
            to={to}
            style={{ textDecoration: 'none' }}
          >
            <Stack
              align="center"
              gap={2}
              py="xs"
              style={{
                color: active
                  ? 'var(--mantine-color-blue-6)'
                  : 'var(--mantine-color-dimmed)',
              }}
            >
              <Icon size={24} stroke={active ? 2 : 1.5} />
              <Text size="xs" fw={active ? 600 : 400}>
                {label}
              </Text>
            </Stack>
          </UnstyledButton>
        )
      })}
    </Group>
  )
}
