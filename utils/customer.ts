/** Display label for the surname field (DB column remains `last_name`). */
export const SURNAME_LABEL = 'Surname';

export function formatCustomerName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function formatCustomerAddress(customer: {
  houseNumber: string;
  street: string;
  area: string;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
}): string {
  return [
    customer.houseNumber,
    customer.street,
    customer.area,
    customer.landmark || null,
    `${customer.city}, ${customer.state}`,
    customer.pincode ? `PIN ${customer.pincode}` : null,
  ]
    .filter(Boolean)
    .join(', ');
}
