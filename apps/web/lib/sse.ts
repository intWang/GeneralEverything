export type JobEvent = {
  event: string;
  data: unknown;
};

type JobEventHandlers = {
  onError?: (error: Event) => void;
  onMessage?: (event: JobEvent) => void;
  onOpen?: () => void;
};

export function subscribeToJobEvents(
  jobId: string,
  handlers: JobEventHandlers = {},
) {
  const eventSource = new EventSource(`/api/jobs/${jobId}/events`);

  eventSource.onopen = () => {
    handlers.onOpen?.();
  };

  eventSource.onmessage = (event) => {
    let parsedData: unknown = event.data;

    try {
      parsedData = JSON.parse(event.data);
    } catch {
      parsedData = event.data;
    }

    handlers.onMessage?.({
      event: event.type,
      data: parsedData,
    });
  };

  eventSource.onerror = (error) => {
    handlers.onError?.(error);
  };

  return () => {
    eventSource.close();
  };
}
