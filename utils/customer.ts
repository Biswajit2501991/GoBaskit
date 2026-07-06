/** Display label for the surname field (DB column remains `last_name`). */
export const SURNAME_LABEL = 'Surname';

export function formatCustomerName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}
