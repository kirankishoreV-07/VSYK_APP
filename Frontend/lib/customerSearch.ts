type SearchableCustomer = {
  id: string;
  full_name?: string | null;
  customer_id?: string | null;
  phone?: string | null;
};

const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/** Keep the recent list unchanged until searching; rank matches deterministically. */
export function searchCustomers<T extends SearchableCustomer>(customers: T[], input: string): T[] {
  const query = normalize(input);
  if (!query) return customers;
  const words = query.split(' ');
  // Name/ID queries must never become empty phone queries (''.includes('') is true).
  const phoneQuery = /^[+\d\s().-]+$/.test(query) ? query.replace(/\D/g, '') : '';

  return customers.map((customer) => {
    const name = normalize(customer.full_name || '');
    const code = normalize(customer.customer_id || '');
    const phone = (customer.phone || '').replace(/\D/g, '');
    let rank = Infinity;
    if (name === query || code === query || (phoneQuery && phone === phoneQuery)) rank = 0;
    else if (name.startsWith(query)) rank = 1;
    else if (words.every((word) => name.split(' ').some((part) => part.startsWith(word)))) rank = 2;
    else if (name.includes(query) || code.startsWith(query)) rank = 3;
    else if (words.every((word) => name.includes(word)) || code.includes(query) || (phoneQuery && phone.includes(phoneQuery))) rank = 4;
    return { customer, name, code, rank };
  })
    .filter(({ rank }) => Number.isFinite(rank))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'en', { numeric: true }) || a.code.localeCompare(b.code, 'en', { numeric: true }) || a.customer.id.localeCompare(b.customer.id))
    .map(({ customer }) => customer);
}
