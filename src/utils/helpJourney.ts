import type { HelpRequest } from '../api/helpRequests';
import { jobStatusOf } from './helpRequestUi';

export type JourneyStepState = 'done' | 'active' | 'pending' | 'failed';

export type JourneyStep = {
  key: string;
  label: string;
  subtitle?: string;
  state: JourneyStepState;
};

type PhaseKey = 'submitted' | 'finding' | 'assigned' | 'ontheway' | 'arrived' | 'working' | 'done';

function currentPhase(request: HelpRequest): PhaseKey {
  if (request.status === 'SEARCHING') return 'finding';
  const job = jobStatusOf(request);
  if (job === 'COMPLETED' || request.status === 'COMPLETED') return 'done';
  if (job === 'IN_PROGRESS') return 'working';
  if (job === 'ARRIVED') return 'arrived';
  if (job === 'ON_THE_WAY') return 'ontheway';
  if (job === 'ACCEPTED' || request.status === 'ACCEPTED') return 'assigned';
  return 'finding';
}

export function buildHelpJourneySteps(request: HelpRequest): JourneyStep[] {
  if (
    request.status === 'NO_MECHANIC_FOUND' ||
    request.status === 'CANCELLED' ||
    request.status === 'EXPIRED'
  ) {
    return [
      { key: 'submitted', label: 'Request sent', state: 'done' },
      {
        key: 'failed',
        label: request.status_label ?? request.status,
        state: 'failed',
        subtitle:
          request.status === 'NO_MECHANIC_FOUND'
            ? 'No one accepted in time — try again'
            : undefined,
      },
    ];
  }

  const phases: Array<{ key: PhaseKey; label: string }> = [
    { key: 'submitted', label: 'Request sent' },
    { key: 'finding', label: 'Finding mechanic' },
    { key: 'assigned', label: 'Accepted' },
    { key: 'ontheway', label: 'On the way' },
    { key: 'arrived', label: 'Arrived' },
    { key: 'working', label: 'In progress' },
    { key: 'done', label: 'Service completed' },
  ];

  const active = currentPhase(request);
  const activeIndex = phases.findIndex((p) => p.key === active);

  return phases.map((p, index) => {
    let state: JourneyStepState = 'pending';
    if (index < activeIndex) state = 'done';
    else if (index === activeIndex) state = 'active';

    const subtitle =
      p.key === 'finding' && request.status === 'SEARCHING'
        ? request.search_progress?.message
        : undefined;

    return { key: p.key, label: p.label, state, subtitle };
  });
}

export function activeJourneyHeadline(request: HelpRequest): string {
  if (request.status === 'SEARCHING') {
    return 'Finding a mechanic nearby…';
  }
  const job = jobStatusOf(request);
  switch (job) {
    case 'ACCEPTED':
      return 'Mechanic accepted your request';
    case 'ON_THE_WAY':
      return 'Mechanic is heading to you';
    case 'ARRIVED':
      return 'Mechanic has arrived';
    case 'IN_PROGRESS':
      return 'Repair in progress';
    case 'COMPLETED':
      return 'All done';
    default:
      return request.status_label ?? request.status;
  }
}
