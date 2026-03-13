/** Имена всех очередей BullMQ в приложении */
export type QueueName =
  | 'otp-send'
  | 'reminders'
  | 'event-changed'
  | 'retention-cleanup'
  | 'dead-letter';

export type OtpSendJobPayload = {
  type: 'otp-send';
  payload: { reddyUserKey: string; message: string };
};

export type ReminderJobPayload = {
  type: 'start-reminder';
  payload: {
    userId: string;
    eventId: string;
    eventTitle: string;
    startsAtUtc: string;
  };
};

export type EventChangedJobPayload = {
  type: 'event-changed';
  payload: {
    participantIds: string[];
    eventId: string;
    eventTitle: string;
    changedFields: string[];
    nextStartsAtUtc: string | null;
    nextLocationOrLink: string | null;
  };
};

export type RetentionCleanupJobPayload = {
  type: 'retention-cleanup';
  payload: Record<string, never>;
};

/**
 * Размеченное объединение payload всех задач в очередях приложения.
 * Позволяет TypeScript проверять корректность payload при добавлении задач
 * и в обработчиках воркеров.
 */
export type QueueJobPayload =
  | OtpSendJobPayload
  | ReminderJobPayload
  | EventChangedJobPayload
  | RetentionCleanupJobPayload;
