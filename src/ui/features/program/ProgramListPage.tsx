import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconEdit, IconPlus, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProgramDef } from '../../../domain'
import { hasHeavyLight } from '../../../domain'
import { useProgramList } from './usePrograms'
import { DeleteProgramModal } from './DeleteProgramModal'

function totalDays(p: ProgramDef): number {
  return p.microcycles.reduce((sum, mc) => sum + mc.days.length, 0)
}

function ProgramCard({
  program,
  onEdit,
  onDelete,
}: {
  program: ProgramDef
  onEdit: (p: ProgramDef) => void
  onDelete: (p: ProgramDef) => void
}) {
  const hl = hasHeavyLight(program)
  const days = totalDays(program)

  return (
    <Card withBorder radius="md" p="md">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2}>
            <Text fw={600}>{program.name}</Text>
            <Text size="sm" c="dimmed">
              {program.microcycles.length} microcycle{program.microcycles.length !== 1 ? 's' : ''} ·{' '}
              {days} day{days !== 1 ? 's' : ''}
            </Text>
          </Stack>
          <Group gap="xs" wrap="nowrap">
            {hl && (
              <Badge variant="light" size="sm" color="violet">
                Heavy/Light
              </Badge>
            )}
          </Group>
        </Group>
        <Group gap="xs">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconEdit size={14} />}
            onClick={() => onEdit(program)}
          >
            Edit
          </Button>
          <Button
            variant="subtle"
            size="xs"
            color="red"
            leftSection={<IconTrash size={14} />}
            onClick={() => onDelete(program)}
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

export function ProgramListPage() {
  const navigate = useNavigate()
  const { data: programs = [], isLoading, error } = useProgramList()
  const [deleteProgram, setDeleteProgram] = useState<ProgramDef | null>(null)

  return (
    <Container size="sm" py="md">
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={2}>Programs</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            size="sm"
            onClick={() => navigate('/programs/new')}
          >
            Add
          </Button>
        </Group>

        {isLoading && <Loader mx="auto" />}
        {error && <Alert color="red">{error.message}</Alert>}

        {!isLoading && !error && programs.length === 0 && (
          <Text c="dimmed" ta="center" mt="xl">
            No programs yet. Add your first program.
          </Text>
        )}

        {programs.map(p => (
          <ProgramCard
            key={p.id as string}
            program={p}
            onEdit={prog => navigate(`/programs/${prog.id as string}/edit`)}
            onDelete={setDeleteProgram}
          />
        ))}
      </Stack>

      <DeleteProgramModal program={deleteProgram} onClose={() => setDeleteProgram(null)} />
    </Container>
  )
}
