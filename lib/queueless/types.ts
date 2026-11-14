export type QueueLessCategory =
  | "campus_office"
  | "food_coffee"
  | "library"
  | "city_service";

export type QueueLessTicketStatus =
  | "WAITING"
  | "NOTIFIED"
  | "SERVING"
  | "COMPLETED"
  | "NO_SHOW"
  | "DELAYED";

export type QueueLessLocation = {
  id: string;
  code: string;
  name: string;
  category: QueueLessCategory;
  description: string;
  address: string;
  average_service_minutes: number;
  required_documents: string[];
  waiting_count: number;
  estimated_wait_minutes: number;
  stats_updated_at?: string | null;
};

export type QueueLessTicket = {
  id: string;
  location_id: string;
  user_id: string;
  ticket_number: number;
  ticket_code: string;
  queue_position: number;
  status: QueueLessTicketStatus;
  delay_used: boolean;
  counter_name: string | null;
  called_at: string | null;
  created_at: string;
  updated_at: string;
};

export type QueueLessStaffTicket = Pick<
  QueueLessTicket,
  "id" | "ticket_code" | "queue_position" | "status" | "delay_used" | "counter_name"
>;

export type QueueLessStaffLocation = {
  id: string;
  name: string;
  category: QueueLessCategory;
  waiting_count: number;
  estimated_wait_minutes: number;
  tickets: QueueLessStaffTicket[];
};
