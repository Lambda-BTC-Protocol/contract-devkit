import { Event } from "@/contracts/types/event";

export type EventLogger = {
  log: (event: Omit<Event, "contract">) => void;
};
