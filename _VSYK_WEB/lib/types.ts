// Domain types mirroring the VSYK Supabase schema (the same backend as mobile).
// Money fields are integer paise unless noted.

export interface Customer {
  id: string;
  customer_id?: string | null;
  customer_type?: string | null;
  full_name: string;
  phone: string;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  gstin_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  aadhar_number?: string | null;
  pan_number?: string | null;
  credit_score?: number | null;
  kyc_status?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

export type AccountingType = "accounted" | "unaccounted";

export interface ChitGroup {
  id: string;
  name: string;
  value: number; // paise
  duration_months: number;
  monthly_installment: number; // paise
  status: "upcoming" | "active" | "completed" | "cancelled";
  accounting_type: AccountingType;
  group_code?: string | null;
  capacity?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  interest_rate?: number | null;
  agent_in_charge?: string | null;
  foreman_name?: string | null;
  bank_name?: string | null;
}

export interface ChitMember {
  id: string;
  chit_group_id: string;
  user_id?: string | null;
  customer_id?: string | null;
  ticket_number?: string | null;
  current_month?: number | null;
  bid_status?: "active" | "bidding" | "completed" | "foreclosed" | null;
  joined_at?: string | null;
  chit_groups?: ChitGroup | null;
}

export interface PaymentSchedule {
  id: string;
  chit_member_id: string;
  month_number: number;
  due_date?: string | null;
  amount: number; // paise
  paid: boolean;
  paid_at?: string | null;
  dividend_amount?: number | null; // paise
}

export interface ChitMemberTransaction {
  id: string;
  chit_member_id: string;
  auction_id?: string | null;
  amount: number; // paise
  payment_type: "installment" | "penalty" | "registration";
  status: "completed" | "failed" | "refunded";
  transaction_date: string;
  notes?: string | null;
}

export interface Auction {
  id: string;
  chit_group_id: string;
  auction_number: number;
  scheduled_at?: string | null;
  closes_at?: string | null;
  status: "upcoming" | "live" | "completed" | "cancelled";
  min_bid?: number | null;
  max_bid?: number | null;
  current_bid?: number | null;
  winner_user_id?: string | null;
  winner_member_id?: string | null;
  winner_name?: string | null;
  winner_prize_amount?: number | null; // paise
  installment_due?: number | null; // paise
  dividend_amount?: number | null; // paise
  discount_amount?: number | null; // paise
  final_due_amount?: number | null; // paise
  ended_at?: string | null;
  chit_groups?: ChitGroup | null;
}

export interface AuctionBid {
  id: string;
  auction_id: string;
  user_id?: string | null;
  customer_id?: string | null;
  bid_amount: number; // paise
  bidder_name?: string | null;
  placed_at: string;
}

export interface Nominee {
  id: string;
  user_id: string;
  full_name: string;
  relationship?: string | null;
  phone_number?: string | null;
  date_of_birth?: string | null;
  allocation_percentage?: number | null;
  created_at?: string | null;
}
