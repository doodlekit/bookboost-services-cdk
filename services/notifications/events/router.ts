import AudiobookNotifier from './audiobooks/notifier'
import ContentNotifier from './content/notifier'

const events: any = {
  'services.audiobooks': {
    types: ['audiobook.created', 'revision.created'],
    notifier: AudiobookNotifier
  },
  'services.assistant': {
    types: ['content.generated', 'scheduled.content.generated'],
    notifier: ContentNotifier
  }
}

export async function routeEvent(source: string, eventType: string, body: any) {
  const eventTypes = events[source].types
  if (!eventTypes) {
    return
  }
  if (!eventTypes.includes(eventType)) {
    return
  }
  const notifier = events[source].notifier
  await notifier(source, eventType, body)
}

export function getSources() {
  const sources: any = {}
  for (const source in events) {
    sources[source] = events[source].types
  }
  return sources
}
