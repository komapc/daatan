/** Standard result type returned by service layer operations. */
export type ServiceResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number }
