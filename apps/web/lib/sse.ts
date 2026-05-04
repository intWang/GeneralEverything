import { buildApiUrl } from "./api";

export type JobEvent = {
  event: string;
  data: unknown;
};

type JobEventHandlers = {
  eventNames?: readonly string[];
  onError?: (error: Event) => void;
  onEvent?: (event: JobEvent) => void;
  onMessage?: (event: JobEvent) => void;
  onOpen?: () => void;
};

const DEFAULT_EVENT_NAMES = ["job.status"] as const;

function parseEventData(data: string) {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return data;
  }
}

export function subscribeToJobEvents(
  jobId: string,
  handlers: JobEventHandlers = {},
) {
  if (typeof EventSource === "undefined") {
    return () => undefined;
  }

  const eventSource = new EventSource(buildApiUrl(`/jobs/${jobId}/events`));
  const eventNames = handlers.eventNames ?? DEFAULT_EVENT_NAMES;
  const listeners = eventNames.map((eventName) => {
    const listener: EventListener = (event) => {
      const messageEvent = event as MessageEvent<string>;

      handlers.onEvent?.({
        event: eventName,
        data: parseEventData(messageEvent.data),
      });
    };

    eventSource.addEventListener(eventName, listener);

    return { eventName, listener };
  });

  eventSource.onopen = () => {
    handlers.onOpen?.();
  };

  eventSource.onmessage = (event) => {
    handlers.onMessage?.({
      event: event.type,
      data: parseEventData(event.data),
    });
  };

  eventSource.onerror = (error) => {
    handlers.onError?.(error);
  };

  return () => {
    listeners.forEach(({ eventName, listener }) => {
      eventSource.removeEventListener(eventName, listener);
    });
    eventSource.close();
  };
}
