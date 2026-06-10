# Requirements Document

## Introduction

This document specifies the requirements for rebuilding the admin-side Customer Detail page as a comprehensive nested-tab interface for the VSYK chit fund management application. The system will provide admin users with a drill-downable view that surfaces complete customer chit history, including groups, payments, auctions, and system events, organized to support fast administrative tasks such as payment verification, failure investigation, and outcome review.

The rebuilt interface replaces the existing customer detail screen with a multi-level tabbed architecture that handles 12 edge cases, supports real-time updates, and maintains performance across large datasets without pagination limits on critical views.

## Glossary

- **Admin_Customer_Detail_Page**: The rebuilt customer detail screen accessible only to admin users for comprehensive customer management
- **Customer_Profile**: The customer record containing identity, contact, KYC status, and membership metadata
- **Chit_Member**: A customer's membership in a specific chit group
- **Payment_Schedule**: The monthly payment obligation for a chit member
- **Chit_Transaction**: A payment record linking a chit member to a specific amount, payment type, and settlement status
- **Auction**: A monthly bidding event for a chit group where members compete for the prize pool
- **Auction_Participant**: A record indicating a customer joined a specific auction
- **Dividend**: The discount amount a member receives after an auction, calculated as their share of the winning bid and subtracted at collection time (pre-deduction model)
- **Post_Win_Period**: The months after a member has won an auction prize, during which they continue paying installments
- **KYC_Status**: The Know Your Customer verification state (pending, verified, rejected)
- **Risk_Badge**: A derived indicator showing payment reliability (on-time, late, defaulted)
- **Month_Strip**: A visual timeline showing payment status icons for each month in a group
- **Supabase_Realtime**: The Supabase subscription mechanism for live database updates
- **React_Query**: The data-fetching library used for server state management
- **IST**: Indian Standard Time (UTC+5:30), the display timezone for all timestamps
- **Paise**: Integer currency unit (1 rupee = 100 paise), the storage format for all monetary values
- **Foreclosed_Group**: A chit group terminated early due to payment defaults or other administrative reasons
- **Unlinked_Transaction**: A payment record that cannot be matched to a specific month or auction
- **Lazy_Loading**: Progressive data loading triggered by user scroll or interaction

## Requirements

### Requirement 1: Display Customer Profile Header

**User Story:** As an admin, I want to see the customer's profile summary at the top of the detail page, so that I can quickly identify the customer and access key information.

#### Acceptance Criteria

1. THE Admin_Customer_Detail_Page SHALL display a sticky header containing customer avatar, full name, phone number, customer ID, and member-since date
2. WHEN the customer has a KYC_Status, THE Admin_Customer_Detail_Page SHALL display a KYC badge with color coding (green for verified, yellow for pending, red for rejected)
3. THE Admin_Customer_Detail_Page SHALL display a Risk_Badge derived from payment history with color coding (green for on-time, yellow for occasional late, red for defaulted)
4. THE Admin_Customer_Detail_Page SHALL provide quick action buttons for Call and Email in the header
5. WHEN the customer has no phone number, THE Admin_Customer_Detail_Page SHALL disable the Call button with explanatory text
6. WHEN the customer has no email address, THE Admin_Customer_Detail_Page SHALL disable the Email button with explanatory text

### Requirement 2: Display Key Performance Indicators

**User Story:** As an admin, I want to see aggregated customer metrics in a KPI strip, so that I can assess the customer's overall portfolio health at a glance.

#### Acceptance Criteria

1. THE Admin_Customer_Detail_Page SHALL display a KPI strip showing Active Chits count, Lifetime Paid amount, Dividend Earned amount, Outstanding amount, and On-time Payment Percentage
2. THE Admin_Customer_Detail_Page SHALL calculate Lifetime Paid as the sum of all completed installment transactions across all Chit_Member records
3. THE Admin_Customer_Detail_Page SHALL calculate Dividend Earned as the sum of all dividend_amount values from Payment_Schedule records where paid is true
4. THE Admin_Customer_Detail_Page SHALL calculate Outstanding as the sum of remaining amounts (due minus paid) for all unpaid or partially paid Payment_Schedule records
5. THE Admin_Customer_Detail_Page SHALL calculate On-time Payment Percentage as the ratio of payments made before due_date to total payments made
6. THE Admin_Customer_Detail_Page SHALL format all monetary values in paise as rupees with Indian number formatting (₹X,XX,XXX)
7. THE Admin_Customer_Detail_Page SHALL display percentage values with one decimal place

### Requirement 3: Provide Outer Tab Navigation

**User Story:** As an admin, I want to navigate between different customer information categories using outer tabs, so that I can focus on specific aspects of the customer's activity.

#### Acceptance Criteria

1. THE Admin_Customer_Detail_Page SHALL provide outer tabs labeled Overview, Groups, Payments, Auctions, Diagnostics, and Activity
2. WHEN an outer tab is selected, THE Admin_Customer_Detail_Page SHALL display the corresponding content panel
3. THE Admin_Customer_Detail_Page SHALL persist the selected outer tab in component state during the session
4. THE Admin_Customer_Detail_Page SHALL highlight the active outer tab with visual distinction (color, underline, or background)
5. THE Admin_Customer_Detail_Page SHALL render tab content lazily to optimize initial load performance

### Requirement 4: Display Overview Tab Content

**User Story:** As an admin, I want to see a summary dashboard in the Overview tab, so that I can quickly understand the customer's current state and recent activity.

#### Acceptance Criteria

1. WHEN the Overview tab is selected, THE Admin_Customer_Detail_Page SHALL display a summary card for each active Chit_Member showing group name, current month, bid status, next due date, and next due amount
2. WHEN the Overview tab is selected, THE Admin_Customer_Detail_Page SHALL display a recent transactions list showing the 10 most recent Chit_Transaction records sorted by transaction_date descending
3. WHEN the Overview tab is selected, THE Admin_Customer_Detail_Page SHALL display upcoming auctions for groups where the customer is a Chit_Member
4. WHEN the customer has overdue payments, THE Admin_Customer_Detail_Page SHALL display an alert banner in the Overview tab showing overdue count and total overdue amount
5. WHEN the customer has no active chit memberships, THE Admin_Customer_Detail_Page SHALL display a placeholder message in the Overview tab

### Requirement 5: Display Groups Tab with Per-Group Inner Tabs

**User Story:** As an admin, I want to drill down into each group the customer belongs to using inner tabs, so that I can investigate group-specific payment and auction history.

#### Acceptance Criteria

1. WHEN the Groups tab is selected, THE Admin_Customer_Detail_Page SHALL display a list of all Chit_Member records for the customer
2. WHEN a group is selected from the list, THE Admin_Customer_Detail_Page SHALL display inner tabs labeled Summary, Payment History, Auction History, Documents, and Ledger
3. THE Admin_Customer_Detail_Page SHALL persist the selected group and inner tab in component state during the session
4. WHEN the Summary inner tab is selected, THE Admin_Customer_Detail_Page SHALL display group details including name, value, duration, monthly installment, status, start date, current month, and bid status
5. WHEN the Summary inner tab is selected, THE Admin_Customer_Detail_Page SHALL display aggregate payment statistics for the group including total paid, total due, outstanding, and completion percentage

### Requirement 6: Display Payment History with Month Strip

**User Story:** As an admin, I want to see a visual month strip showing payment status for each month, so that I can quickly identify payment patterns and issues.

#### Acceptance Criteria

1. WHEN the Payment History inner tab is selected, THE Admin_Customer_Detail_Page SHALL display a Month_Strip showing status icons for each month from month 1 to the group's duration_months
2. WHEN a month in the Month_Strip has a completed payment, THE Admin_Customer_Detail_Page SHALL display a green checkmark icon
3. WHEN a month in the Month_Strip has a partial payment, THE Admin_Customer_Detail_Page SHALL display a yellow half-filled icon
4. WHEN a month in the Month_Strip has no payment and is overdue, THE Admin_Customer_Detail_Page SHALL display a red exclamation icon
5. WHEN a month in the Month_Strip has no payment and is not yet due, THE Admin_Customer_Detail_Page SHALL display a gray circle icon
6. WHEN a month in the Month_Strip is clicked, THE Admin_Customer_Detail_Page SHALL scroll to the corresponding month detail row in the payment table
7. THE Admin_Customer_Detail_Page SHALL display the Month_Strip as a horizontally scrollable component with month numbers and status icons

### Requirement 7: Display Full Payment Table Without Pagination

**User Story:** As an admin, I want to see all payment records in a single scrollable table, so that I can analyze the complete payment history without navigating between pages.

#### Acceptance Criteria

1. WHEN the Payment History inner tab is selected, THE Admin_Customer_Detail_Page SHALL display a table containing all Payment_Schedule records for the selected Chit_Member ordered by month_number ascending
2. THE payment table SHALL display columns for Month, Due Date, Amount Due, Amount Paid, Remaining, Status, Dividend, and Actions
3. THE Admin_Customer_Detail_Page SHALL calculate Amount Paid as the sum of completed installment Chit_Transaction records linked to the month
4. THE Admin_Customer_Detail_Page SHALL calculate Remaining as (Amount Due - Amount Paid) clamped to minimum zero
5. THE Admin_Customer_Detail_Page SHALL display Status as Full when Amount Paid is greater than or equal to Amount Due
6. THE Admin_Customer_Detail_Page SHALL display Status as Partial when Amount Paid is greater than zero and less than Amount Due
7. THE Admin_Customer_Detail_Page SHALL display Status as Unpaid when Amount Paid is zero
8. WHEN a Payment_Schedule record has a due_date in the past and Status is not Full, THE Admin_Customer_Detail_Page SHALL mark the row as overdue with visual styling (red text or background)
9. THE Admin_Customer_Detail_Page SHALL render the payment table as a virtualized list when the row count exceeds 100 to maintain performance

### Requirement 8: Handle Partial Payment Edge Case

**User Story:** As an admin, I want to see partial payment details including multiple transaction records summing to less than the due amount, so that I can verify payment progress and outstanding balance.

#### Acceptance Criteria

1. WHEN multiple Chit_Transaction records exist for a single Payment_Schedule with sum less than the due amount, THE Admin_Customer_Detail_Page SHALL display Status as Partial
2. WHEN a payment row is expanded, THE Admin_Customer_Detail_Page SHALL display all Chit_Transaction records linked to that month showing transaction_date, amount, status, and notes
3. THE Admin_Customer_Detail_Page SHALL sum all completed Chit_Transaction amounts to calculate the total paid for the month
4. THE Admin_Customer_Detail_Page SHALL display the remaining amount as (due - total paid) in the payment table row

### Requirement 9: Handle Late Payment Edge Case

**User Story:** As an admin, I want to identify late payments where the payment was made after the due date, so that I can track payment timeliness and assess risk.

#### Acceptance Criteria

1. WHEN a Chit_Transaction has a transaction_date after the Payment_Schedule due_date, THE Admin_Customer_Detail_Page SHALL mark the payment as late with visual indication (yellow warning icon)
2. THE Admin_Customer_Detail_Page SHALL calculate the number of days late as (transaction_date - due_date) in days
3. WHEN a payment row is expanded, THE Admin_Customer_Detail_Page SHALL display the days late metric for each late transaction
4. THE Admin_Customer_Detail_Page SHALL include late payments in the On-time Payment Percentage calculation as non-on-time

### Requirement 10: Handle Failed-Then-Retried Payment Edge Case

**User Story:** As an admin, I want to see failed payment attempts followed by successful retries, so that I can understand payment issues and resolution attempts.

#### Acceptance Criteria

1. WHEN multiple Chit_Transaction records exist for a single month with different status values, THE Admin_Customer_Detail_Page SHALL display all transactions including failed and completed
2. WHEN a payment row is expanded, THE Admin_Customer_Detail_Page SHALL order Chit_Transaction records by transaction_date ascending to show chronological retry sequence
3. THE Admin_Customer_Detail_Page SHALL visually distinguish failed transactions with red strikethrough text and failed status badge
4. THE Admin_Customer_Detail_Page SHALL only include completed and success status transactions in the Amount Paid calculation

### Requirement 11: Handle Refund Edge Case

**User Story:** As an admin, I want to see refunded payments and understand how they affect the payment balance, so that I can reconcile accounts and verify refund processing.

#### Acceptance Criteria

1. WHEN a Chit_Transaction has status refunded, THE Admin_Customer_Detail_Page SHALL display the transaction with a refund badge and subtract the amount from Amount Paid
2. WHEN a payment row is expanded, THE Admin_Customer_Detail_Page SHALL display refunded transactions in the transaction list with refund icon and timestamp
3. THE Admin_Customer_Detail_Page SHALL calculate net Amount Paid as (sum of completed transactions - sum of refunded transactions)
4. WHEN a refund results in negative Amount Paid, THE Admin_Customer_Detail_Page SHALL display the negative value in parentheses with red text

### Requirement 12: Handle Won Cycle Edge Case

**User Story:** As an admin, I want to identify the month when the customer won the auction and distinguish post-win payments, so that I can verify prize disbursement and subsequent installment obligations.

#### Acceptance Criteria

1. WHEN an Auction record has winner_member_id matching the Chit_Member id, THE Admin_Customer_Detail_Page SHALL identify the auction_number as the won month
2. THE Admin_Customer_Detail_Page SHALL display a special Won badge in the payment table row for the won month
3. WHEN the current month_number is greater than the won month, THE Admin_Customer_Detail_Page SHALL mark the payment row as Post_Win_Period with visual indicator (purple tag)
4. WHEN the Payment History inner tab is selected, THE Admin_Customer_Detail_Page SHALL display the prize amount received (winner_prize_amount) in the won month row
5. THE Admin_Customer_Detail_Page SHALL display the adjusted installment amount (final_due_amount) for the won month considering dividend pre-deduction

### Requirement 13: Handle Foreclosed Group Edge Case

**User Story:** As an admin, I want to see when a group has been foreclosed and understand the impact on the customer's obligations, so that I can manage final settlements and customer communication.

#### Acceptance Criteria

1. WHEN a Chit_Member has bid_status set to foreclosed, THE Admin_Customer_Detail_Page SHALL display a Foreclosed alert banner in the group Summary inner tab
2. WHEN a group is foreclosed, THE Admin_Customer_Detail_Page SHALL display foreclosure date, reason, and settlement status in the Summary inner tab
3. THE Admin_Customer_Detail_Page SHALL continue displaying all Payment_Schedule records for a foreclosed group with visual distinction (grayed out for future months)
4. WHEN calculating Outstanding for a foreclosed group, THE Admin_Customer_Detail_Page SHALL only include amounts up to the foreclosure date

### Requirement 14: Handle Manual Adjustment Edge Case

**User Story:** As an admin, I want to see manual adjustments to payment amounts and understand why they were made, so that I can audit account modifications and verify admin actions.

#### Acceptance Criteria

1. WHEN a Chit_Transaction has payment_type set to penalty or a negative amount indicating an adjustment, THE Admin_Customer_Detail_Page SHALL display the transaction with an Adjustment badge
2. WHEN a payment row is expanded, THE Admin_Customer_Detail_Page SHALL display adjustment transactions with a special icon and the notes field explaining the reason
3. THE Admin_Customer_Detail_Page SHALL include penalty transactions in the Amount Paid calculation
4. WHEN an adjustment results in a change to the Payment_Schedule amount field, THE Admin_Customer_Detail_Page SHALL display both original and adjusted amounts with visual indication

### Requirement 15: Handle Dividend Recalculation Edge Case

**User Story:** As an admin, I want to see when dividends have been recalculated and the impact on member obligations, so that I can verify calculation accuracy and communicate changes to members.

#### Acceptance Criteria

1. WHEN a Payment_Schedule record has a dividend_amount that differs from the expected calculated value based on the Auction discount_amount, THE Admin_Customer_Detail_Page SHALL display a Recalculated badge
2. WHEN the Payment History inner tab is selected, THE Admin_Customer_Detail_Page SHALL display both the original and recalculated dividend amounts in the month row
3. THE Admin_Customer_Detail_Page SHALL calculate expected dividend as (Auction discount_amount / group member count)
4. WHEN a dividend recalculation affects the final_due_amount, THE Admin_Customer_Detail_Page SHALL display the adjusted amount in the payment table

### Requirement 16: Handle Missing Schedule Edge Case

**User Story:** As an admin, I want to identify months where Payment_Schedule records are missing and see unlinked transactions, so that I can reconcile data and fix scheduling issues.

#### Acceptance Criteria

1. WHEN a Chit_Transaction exists for a Chit_Member but no matching Payment_Schedule record exists, THE Admin_Customer_Detail_Page SHALL classify the transaction as unlinked
2. WHEN the Payment History inner tab is selected, THE Admin_Customer_Detail_Page SHALL display an Unlinked Payments section below the main payment table
3. THE Admin_Customer_Detail_Page SHALL display unlinked transactions with transaction_date, amount, status, and notes
4. THE Admin_Customer_Detail_Page SHALL provide a Link to Month action button for each unlinked transaction allowing admin to manually assign it to a month_number
5. WHEN a month_number from 1 to duration_months does not have a Payment_Schedule record, THE Admin_Customer_Detail_Page SHALL display a placeholder row in the payment table with Create Schedule action

### Requirement 17: Handle No Groups Edge Case

**User Story:** As an admin, I want to see a helpful message when a customer has no chit memberships, so that I understand the empty state and can take appropriate action.

#### Acceptance Criteria

1. WHEN a Customer_Profile has no associated Chit_Member records, THE Admin_Customer_Detail_Page SHALL display an empty state message in the Groups tab
2. THE empty state message SHALL read "This customer has not joined any chit groups yet"
3. THE Admin_Customer_Detail_Page SHALL hide the inner tabs (Summary, Payment History, Auction History, Documents, Ledger) when no groups exist
4. THE Admin_Customer_Detail_Page SHALL display zero values for all KPI metrics (Active Chits, Lifetime Paid, Dividend Earned, Outstanding)

### Requirement 18: Implement Lazy Loading for Large Datasets

**User Story:** As an admin, I want the page to load quickly even for customers with extensive histories, so that I can access information without performance delays.

#### Acceptance Criteria

1. THE Admin_Customer_Detail_Page SHALL initially load only Customer_Profile, Chit_Member records, and summary statistics
2. WHEN the Groups tab is selected, THE Admin_Customer_Detail_Page SHALL load Payment_Schedule and Auction records for all groups
3. WHEN a Payment History inner tab is selected, THE Admin_Customer_Detail_Page SHALL load Chit_Transaction records for the selected group
4. WHEN the Auctions tab is selected, THE Admin_Customer_Detail_Page SHALL load Auction and Auction_Participant records
5. THE Admin_Customer_Detail_Page SHALL display loading skeletons during data fetching with smooth transitions to loaded content
6. WHEN a data fetch fails, THE Admin_Customer_Detail_Page SHALL display an error message with a Retry button

### Requirement 19: Subscribe to Real-Time Transaction Updates

**User Story:** As an admin, I want to see new transactions appear automatically without refreshing, so that I can monitor ongoing payment activity in real-time.

#### Acceptance Criteria

1. WHEN the Admin_Customer_Detail_Page is mounted, THE system SHALL establish a Supabase_Realtime subscription on the chit_member_transactions table filtered by chit_member_id values for the current customer
2. WHEN a new Chit_Transaction record is inserted, THE Admin_Customer_Detail_Page SHALL add the transaction to the appropriate month row in the payment table and update Amount Paid and Remaining
3. WHEN an existing Chit_Transaction record is updated, THE Admin_Customer_Detail_Page SHALL update the transaction details in the payment table and recalculate totals
4. WHEN a Chit_Transaction record is deleted, THE Admin_Customer_Detail_Page SHALL remove the transaction from the payment table and recalculate totals
5. WHEN the Admin_Customer_Detail_Page is unmounted, THE system SHALL clean up the Supabase_Realtime subscription to prevent memory leaks

### Requirement 20: Display Auction History Inner Tab

**User Story:** As an admin, I want to see all auctions for a group and identify which ones the customer participated in or won, so that I can understand their bidding behavior and outcomes.

#### Acceptance Criteria

1. WHEN the Auction History inner tab is selected, THE Admin_Customer_Detail_Page SHALL display a table of all Auction records for the selected group ordered by auction_number ascending
2. THE auction table SHALL display columns for Auction Number, Date, Status, Winner, Prize Amount, Discount, and Customer Participation
3. WHEN an Auction_Participant record exists linking the customer to an Auction, THE Admin_Customer_Detail_Page SHALL display a Participated badge in the Customer Participation column
4. WHEN an Auction has winner_member_id matching the Chit_Member id, THE Admin_Customer_Detail_Page SHALL display a Won badge in the Customer Participation column
5. THE Admin_Customer_Detail_Page SHALL display the winner_prize_amount in the Prize Amount column formatted as rupees
6. WHEN the customer did not participate in an Auction, THE Admin_Customer_Detail_Page SHALL display a dash or empty state in the Customer Participation column

### Requirement 21: Export Payment History to CSV

**User Story:** As an admin, I want to export the payment history to CSV format, so that I can analyze data offline or share with other stakeholders.

#### Acceptance Criteria

1. WHEN the Payment History inner tab is selected, THE Admin_Customer_Detail_Page SHALL display an Export to CSV button
2. WHEN the Export to CSV button is clicked, THE Admin_Customer_Detail_Page SHALL generate a CSV file containing all Payment_Schedule records with columns Month, Due Date, Amount Due, Amount Paid, Remaining, Status, Dividend, Transactions
3. THE CSV file SHALL include expanded transaction details with multiple rows per month when multiple Chit_Transaction records exist
4. THE Admin_Customer_Detail_Page SHALL format all monetary values in the CSV as rupees with two decimal places
5. THE Admin_Customer_Detail_Page SHALL format all date values in the CSV as IST in YYYY-MM-DD format
6. THE CSV file SHALL be named using the pattern "customer-{customer_id}-group-{group_name}-payments-{timestamp}.csv"

### Requirement 22: Display Activity Timeline

**User Story:** As an admin, I want to see a chronological activity log showing all customer actions and system events, so that I can audit customer behavior and troubleshoot issues.

#### Acceptance Criteria

1. WHEN the Activity tab is selected, THE Admin_Customer_Detail_Page SHALL display a timeline of all events sorted by timestamp descending
2. THE activity timeline SHALL include events for: transaction created, transaction updated, transaction failed, auction joined, auction left, auction won, schedule created, schedule updated, membership created, membership updated, KYC status changed
3. THE Admin_Customer_Detail_Page SHALL display each event with timestamp, event type icon, description, and affected entity (group name, month number, or transaction id)
4. THE Admin_Customer_Detail_Page SHALL format all timestamps in IST with date and time (DD MMM YYYY, HH:MM)
5. WHEN an activity event is clicked, THE Admin_Customer_Detail_Page SHALL navigate to the relevant detail view (group tab, payment row, or auction record)
6. THE Admin_Customer_Detail_Page SHALL implement infinite scroll for the activity timeline loading 20 events at a time

### Requirement 23: Reuse Existing React Query Hooks

**User Story:** As a developer, I want to reuse existing data fetching hooks where applicable, so that I maintain consistency and avoid code duplication.

#### Acceptance Criteria

1. THE Admin_Customer_Detail_Page SHALL use the existing useAdminCustomerDetail hook from Frontend/lib/hooks/useAdminCustomerDetail.ts for initial data loading
2. WHEN additional admin-specific queries are needed, THE system SHALL create new hooks in the Frontend/lib/hooks/admin/ directory
3. THE system SHALL follow the existing React_Query pattern with queryKey arrays structured as [entity-type, identifier, filter-params]
4. THE system SHALL configure staleTime and cacheTime appropriately with longer durations (5 minutes) for stable data like customer profiles and shorter durations (30 seconds) for volatile data like transactions

### Requirement 24: Implement TypeScript Strict Mode Compliance

**User Story:** As a developer, I want all new code to comply with TypeScript strict mode, so that I prevent runtime type errors and maintain code quality.

#### Acceptance Criteria

1. THE system SHALL define TypeScript interfaces for all component props with no use of the any type
2. THE system SHALL define TypeScript interfaces for all API response types matching Supabase table schemas
3. THE system SHALL use explicit return type annotations for all functions longer than 10 lines
4. THE system SHALL enable strictNullChecks and handle null and undefined cases explicitly with optional chaining or null checks
5. WHEN a type cannot be precisely defined, THE system SHALL use union types or branded types instead of any

### Requirement 25: Limit Component Size to 300 Lines

**User Story:** As a developer, I want each tab component to remain under 300 lines, so that I maintain readability and ease of maintenance.

#### Acceptance Criteria

1. THE system SHALL extract each inner tab (Summary, Payment History, Auction History, Documents, Ledger) into a separate component file
2. WHEN a tab component exceeds 250 lines, THE system SHALL extract reusable sub-components such as table rows, cards, or modals
3. THE system SHALL place all tab components in a Frontend/app/(admin)/customers/components/ directory
4. THE system SHALL follow the naming convention {TabName}Tab.tsx for outer tab components and {GroupTabName}InnerTab.tsx for inner tab components

### Requirement 26: Format Money Values Consistently

**User Story:** As a user, I want all monetary values to be displayed in rupees with Indian number formatting, so that I can easily read and understand financial data.

#### Acceptance Criteria

1. THE Admin_Customer_Detail_Page SHALL store all monetary values in the database as integer paise
2. THE Admin_Customer_Detail_Page SHALL convert paise to rupees by dividing by 100 before display
3. THE Admin_Customer_Detail_Page SHALL format rupee values using the pattern ₹X,XX,XXX with Indian numbering (lakhs and crores)
4. THE Admin_Customer_Detail_Page SHALL display rupee values with zero decimal places for whole numbers and two decimal places when fractional paise exist
5. THE system SHALL use the existing formatPaise utility function from Frontend/lib/hooks/useDashboard.ts for all monetary formatting

### Requirement 27: Display Timestamps in IST

**User Story:** As a user, I want all timestamps to be displayed in Indian Standard Time, so that I can relate times to my local timezone.

#### Acceptance Criteria

1. THE system SHALL store all timestamps in the database as UTC
2. THE Admin_Customer_Detail_Page SHALL convert UTC timestamps to IST by adding 5 hours and 30 minutes before display
3. THE Admin_Customer_Detail_Page SHALL format date values using the pattern DD MMM YYYY (e.g., 15 Jan 2024)
4. THE Admin_Customer_Detail_Page SHALL format datetime values using the pattern DD MMM YYYY, HH:MM (e.g., 15 Jan 2024, 14:30)
5. THE system SHALL use the existing formatShortDate utility function from Frontend/lib/hooks/useDashboard.ts for date formatting

### Requirement 28: Parse Configuration Grammar for Supabase Queries

**User Story:** As a developer, I want to construct efficient Supabase queries with proper joins and filters, so that I minimize network round trips and database load.

#### Acceptance Criteria

1. THE system SHALL use Supabase select queries with nested relation syntax (e.g., `chit_groups(*)`) to fetch related records in a single request
2. THE system SHALL use Supabase filter operators (eq, in, gte, lte, neq) to reduce data transfer by filtering on the database side
3. THE system SHALL use Supabase order operators to sort results on the database side before transfer
4. THE system SHALL limit the number of records fetched when displaying summary views using the limit operator
5. WHEN fetching large datasets, THE system SHALL use Supabase range pagination with from/to parameters to implement incremental loading

### Requirement 29: Implement Round-Trip Property for CSV Export

**User Story:** As a developer, I want to verify that exported CSV data can be parsed back to the original structure, so that I ensure data integrity in the export process.

#### Acceptance Criteria

1. THE system SHALL include a CSV parser utility function that accepts CSV text and returns an array of payment record objects
2. THE system SHALL include a CSV formatter utility function that accepts an array of payment record objects and returns CSV text
3. FOR ALL valid payment record arrays, THE system SHALL satisfy the round-trip property: parsing then formatting then parsing SHALL produce an equivalent array
4. THE round-trip property test SHALL compare all fields including Month, Due Date, Amount Due, Amount Paid, Remaining, Status, and Dividend
5. THE round-trip property test SHALL handle edge cases including empty arrays, single records, records with missing optional fields, and records with special characters in notes

### Requirement 30: Provide Diagnostics Tab for System Health

**User Story:** As an admin, I want to see diagnostic information about data quality issues for the customer, so that I can identify and fix data inconsistencies.

#### Acceptance Criteria

1. WHEN the Diagnostics tab is selected, THE Admin_Customer_Detail_Page SHALL display a list of detected data quality issues grouped by severity (error, warning, info)
2. THE Admin_Customer_Detail_Page SHALL detect and display error-level issues including: missing Payment_Schedule records for months with transactions, Chit_Transaction records with null chit_member_id, Payment_Schedule records with amount less than zero
3. THE Admin_Customer_Detail_Page SHALL detect and display warning-level issues including: unlinked Chit_Transaction records, late payments exceeding 30 days, partial payments older than 60 days, dividend_amount discrepancies
4. THE Admin_Customer_Detail_Page SHALL detect and display info-level issues including: zero-value Payment_Schedule records, Auction records with null winner after completion, duplicate Auction_Participant records
5. WHEN a diagnostic issue is clicked, THE Admin_Customer_Detail_Page SHALL navigate to the relevant detail view with the problematic record highlighted
6. THE Admin_Customer_Detail_Page SHALL display a count of issues by severity in the Diagnostics tab label (e.g., "Diagnostics (2)")
