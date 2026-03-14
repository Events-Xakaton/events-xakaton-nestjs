CREATE TABLE "AttendanceConfirmation" (
    "eventId"     TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "rating"      INTEGER,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceConfirmation_pkey" PRIMARY KEY ("eventId", "userId")
);

CREATE INDEX "AttendanceConfirmation_eventId_idx" ON "AttendanceConfirmation"("eventId");

ALTER TABLE "AttendanceConfirmation" ADD CONSTRAINT "AttendanceConfirmation_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AttendanceConfirmation" ADD CONSTRAINT "AttendanceConfirmation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
