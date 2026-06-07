export type Step = 0 | 1 | 2 | 3 | 4 | 5;

/** Per-field validation messages keyed by the field they belong to. */
export type Errors = Partial<
  Record<
    | "year"
    | "make"
    | "model"
    | "km"
    | "drivable"
    | "name"
    | "phone"
    | "email"
    | "consentGate"
    | "postal"
    | "slot"
    | "address"
    | "consent",
    string
  >
>;
